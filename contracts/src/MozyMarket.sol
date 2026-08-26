// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {MarketRegistry} from "./MarketRegistry.sol";
import {SettlementVault} from "./SettlementVault.sol";
import {PricingLibrary} from "./PricingLibrary.sol";
import {
    PricingMode,
    MandateStatus,
    ReservationStatus,
    ReservationEligibility,
    MarketConfig,
    Mandate,
    VaultAccount,
    Reservation,
    ReservationQuote
} from "./ProtocolTypes.sol";
import {
    ZeroAddress,
    ProtocolPaused,
    ProtocolNotConfigured,
    VaultAlreadyConfigured,
    MandateNotFound,
    InvalidDeliveryWallet,
    InvalidExpiry,
    InvalidReservationDuration,
    NotMandateBuyer,
    InvalidFundingAmount,
    FundingExceedsRequirement,
    InvalidMandateStatus,
    InvalidRefundAmount,
    RefundExceedsFreeBalance,
    OutstandingMandateBalance,
    AccountingInvariantViolation,
    InvalidBondPolicy,
    ReservationNotFound,
    ReservationAlreadyResolved,
    ReservationNotExpired,
    ReservationDurationUnavailable,
    ExpectedPayoutMismatch,
    InsufficientPayoutBudget,
    ZeroBond
} from "./ProtocolErrors.sol";

/// @notice Owns Acquisition Mandate identity, terms, quantity, and lifecycle.
contract MozyMarket is Ownable, ReentrancyGuard {
    uint256 public constant BPS_DENOMINATOR = 10_000;
    MarketRegistry public immutable registry;
    uint256 public immutable bondRateBps;
    uint256 public immutable bondCap;
    SettlementVault public vault;
    bool public protocolPaused;
    uint256 public nextMandateId = 1;
    uint256 public nextReservationId = 1;

    mapping(uint256 mandateId => Mandate) private _mandates;
    mapping(uint256 mandateId => address settlementToken) private _mandateSettlementTokens;
    mapping(uint256 reservationId => Reservation) private _reservations;

    event ProtocolPauseChanged(bool paused, address indexed admin);
    event VaultConfigured(address indexed vault, address indexed admin);
    event MandateCreated(
        uint256 indexed mandateId,
        address indexed buyer,
        uint256 indexed marketId,
        address deliveryWallet,
        uint256 targetAmount,
        PricingMode pricingMode,
        uint256 startPrice,
        uint256 endPrice,
        uint256 requiredFunding,
        uint64 mandateExpiry,
        uint64 reservationDuration
    );
    event MandateFunded(
        uint256 indexed mandateId, address indexed buyer, uint256 amount, uint256 cumulativeFunding, uint256 remaining
    );
    event MandateOpened(uint256 indexed mandateId, address indexed buyer, uint256 requiredFunding);
    event MandatePaused(uint256 indexed mandateId, address indexed buyer);
    event MandateResumed(uint256 indexed mandateId, address indexed buyer);
    event MandateCancelled(
        uint256 indexed mandateId, address indexed buyer, uint256 uncommittedQuantity, uint256 refundableAmount
    );
    event MandateExpired(uint256 indexed mandateId, address indexed caller, uint256 refundableAmount);
    event BuyerRefunded(uint256 indexed mandateId, address indexed buyer, uint256 amount, uint256 cumulativeRefunded);
    event MandateClosed(uint256 indexed mandateId, address indexed caller);
    event ReservationCreated(
        uint256 indexed reservationId,
        uint256 indexed mandateId,
        address indexed solver,
        uint256 quantity,
        uint256 lockedPayout,
        uint256 bondAmount,
        uint64 deliveryDeadline
    );
    event ReservationExpired(
        uint256 indexed reservationId,
        uint256 indexed mandateId,
        address indexed solver,
        uint256 releasedQuantity,
        uint256 unlockedPayout
    );
    event ReservationBondForfeited(
        uint256 indexed reservationId, address indexed buyer, address indexed token, uint256 amount
    );

    constructor(
        address protocolAdmin,
        MarketRegistry marketRegistry,
        uint256 reservationBondRateBps,
        uint256 reservationBondCap
    ) Ownable(protocolAdmin) {
        if (protocolAdmin == address(0) || address(marketRegistry) == address(0)) revert ZeroAddress();
        if (reservationBondRateBps == 0 || reservationBondRateBps > BPS_DENOMINATOR || reservationBondCap == 0) {
            revert InvalidBondPolicy();
        }
        registry = marketRegistry;
        bondRateBps = reservationBondRateBps;
        bondCap = reservationBondCap;
    }

    function configureVault(SettlementVault settlementVault) external onlyOwner {
        if (address(vault) != address(0)) revert VaultAlreadyConfigured();
        if (address(settlementVault) == address(0) || settlementVault.marketOperator() != address(this)) {
            revert ProtocolNotConfigured();
        }
        vault = settlementVault;
        emit VaultConfigured(address(settlementVault), msg.sender);
    }

    function setProtocolPaused(bool paused) external onlyOwner {
        protocolPaused = paused;
        emit ProtocolPauseChanged(paused, msg.sender);
    }

    function createMandate(
        uint256 marketId,
        address deliveryWallet,
        uint256 targetAmount,
        PricingMode pricingMode,
        uint256 startPrice,
        uint256 endPrice,
        uint64 mandateExpiry,
        uint64 reservationDuration
    ) external returns (uint256 mandateId) {
        _requireConfiguredAndRiskEnabled();
        MarketConfig memory market = registry.requireEnabledMarket(marketId);
        if (deliveryWallet == address(0)) revert InvalidDeliveryWallet();
        if (mandateExpiry <= block.timestamp) revert InvalidExpiry();
        if (reservationDuration == 0 || reservationDuration > mandateExpiry - block.timestamp) {
            revert InvalidReservationDuration();
        }
        PricingLibrary.validateTerms(pricingMode, targetAmount, market.foreignTokenDecimals, startPrice, endPrice);
        uint256 requiredFunding = PricingLibrary.quote(
            pricingMode, targetAmount, market.foreignTokenDecimals, startPrice, endPrice, 0, targetAmount
        );

        mandateId = nextMandateId++;
        _mandates[mandateId] = Mandate({
            id: mandateId,
            buyer: msg.sender,
            marketId: marketId,
            deliveryWallet: deliveryWallet,
            targetAmount: targetAmount,
            acquiredAmount: 0,
            reservedAmount: 0,
            pricingMode: pricingMode,
            startPrice: startPrice,
            endPrice: endPrice,
            requiredFunding: requiredFunding,
            mandateExpiry: mandateExpiry,
            reservationDuration: reservationDuration,
            status: MandateStatus.Funding,
            createdAt: uint64(block.timestamp)
        });
        _mandateSettlementTokens[mandateId] = market.settlementToken;
        emit MandateCreated(
            mandateId,
            msg.sender,
            marketId,
            deliveryWallet,
            targetAmount,
            pricingMode,
            startPrice,
            endPrice,
            requiredFunding,
            mandateExpiry,
            reservationDuration
        );
    }

    function fundMandate(uint256 mandateId, uint256 amount) external nonReentrant {
        _requireConfiguredAndRiskEnabled();
        Mandate storage mandate = _requireMandate(mandateId);
        _requireBuyer(mandate);
        if (mandate.status != MandateStatus.Funding) revert InvalidMandateStatus();
        if (block.timestamp >= mandate.mandateExpiry) revert InvalidExpiry();
        registry.requireEnabledMarket(mandate.marketId);
        if (amount == 0) revert InvalidFundingAmount();

        VaultAccount memory beforeAccount = vault.getAccount(mandateId);
        uint256 remaining = mandate.requiredFunding - beforeAccount.funded;
        if (amount > remaining) revert FundingExceedsRequirement();
        vault.deposit(mandateId, _mandateSettlementTokens[mandateId], msg.sender, amount);
        uint256 cumulativeFunding = beforeAccount.funded + amount;
        emit MandateFunded(mandateId, msg.sender, amount, cumulativeFunding, remaining - amount);
        if (cumulativeFunding == mandate.requiredFunding) {
            mandate.status = MandateStatus.Open;
            emit MandateOpened(mandateId, msg.sender, mandate.requiredFunding);
        }
    }

    function pauseMandate(uint256 mandateId) external {
        Mandate storage mandate = _requireMandate(mandateId);
        _requireBuyer(mandate);
        if (mandate.status != MandateStatus.Open) revert InvalidMandateStatus();
        if (block.timestamp >= mandate.mandateExpiry) revert InvalidExpiry();
        mandate.status = MandateStatus.Paused;
        emit MandatePaused(mandateId, msg.sender);
    }

    function resumeMandate(uint256 mandateId) external {
        _requireConfiguredAndRiskEnabled();
        Mandate storage mandate = _requireMandate(mandateId);
        _requireBuyer(mandate);
        if (mandate.status != MandateStatus.Paused) revert InvalidMandateStatus();
        if (block.timestamp >= mandate.mandateExpiry) revert InvalidExpiry();
        registry.requireEnabledMarket(mandate.marketId);
        VaultAccount memory account = vault.getAccount(mandateId);
        if (account.funded != mandate.requiredFunding) revert AccountingInvariantViolation();
        mandate.status = MandateStatus.Open;
        emit MandateResumed(mandateId, msg.sender);
    }

    function cancelMandate(uint256 mandateId) external {
        Mandate storage mandate = _requireMandate(mandateId);
        _requireBuyer(mandate);
        if (
            mandate.status != MandateStatus.Funding && mandate.status != MandateStatus.Open
                && mandate.status != MandateStatus.Paused
        ) revert InvalidMandateStatus();
        mandate.status = MandateStatus.Cancelled;
        VaultAccount memory account = vault.getAccount(mandateId);
        emit MandateCancelled(
            mandateId, msg.sender, mandate.targetAmount - mandate.acquiredAmount - mandate.reservedAmount, account.free
        );
    }

    function expireMandate(uint256 mandateId) external {
        Mandate storage mandate = _requireMandate(mandateId);
        if (block.timestamp < mandate.mandateExpiry) revert InvalidExpiry();
        if (
            mandate.status != MandateStatus.Funding && mandate.status != MandateStatus.Open
                && mandate.status != MandateStatus.Paused
        ) revert InvalidMandateStatus();
        mandate.status = MandateStatus.Expired;
        emit MandateExpired(mandateId, msg.sender, vault.getAccount(mandateId).free);
    }

    function refundMandate(uint256 mandateId, uint256 amount) external nonReentrant {
        Mandate storage mandate = _requireMandate(mandateId);
        _requireBuyer(mandate);
        if (
            mandate.status != MandateStatus.Cancelled && mandate.status != MandateStatus.Expired
                && mandate.status != MandateStatus.Filled
        ) revert InvalidMandateStatus();
        if (amount == 0) revert InvalidRefundAmount();
        VaultAccount memory account = vault.getAccount(mandateId);
        if (amount > account.free) revert RefundExceedsFreeBalance();
        vault.refund(mandateId, _mandateSettlementTokens[mandateId], mandate.buyer, amount);
        emit BuyerRefunded(mandateId, mandate.buyer, amount, account.refunded + amount);
    }

    function closeMandate(uint256 mandateId) external {
        Mandate storage mandate = _requireMandate(mandateId);
        if (
            mandate.status != MandateStatus.Cancelled && mandate.status != MandateStatus.Expired
                && mandate.status != MandateStatus.Filled
        ) revert InvalidMandateStatus();
        VaultAccount memory account = vault.getAccount(mandateId);
        if (mandate.reservedAmount != 0 || account.reserved != 0 || account.free != 0) {
            revert OutstandingMandateBalance();
        }
        mandate.status = MandateStatus.Closed;
        emit MandateClosed(mandateId, msg.sender);
    }

    function quoteMandate(uint256 mandateId, uint256 quantity)
        external
        view
        returns (uint256 startPosition, uint256 payout, uint256 endPosition)
    {
        Mandate storage mandate = _requireMandate(mandateId);
        MarketConfig memory market = registry.getMarket(mandate.marketId);
        startPosition = mandate.acquiredAmount + mandate.reservedAmount;
        payout = PricingLibrary.quote(
            mandate.pricingMode,
            mandate.targetAmount,
            market.foreignTokenDecimals,
            mandate.startPrice,
            mandate.endPrice,
            startPosition,
            quantity
        );
        endPosition = startPosition + quantity;
    }

    function quoteReservation(uint256 mandateId, uint256 quantity)
        external
        view
        returns (ReservationQuote memory quote)
    {
        if (address(vault) == address(0)) revert ProtocolNotConfigured();
        Mandate storage mandate = _requireMandate(mandateId);
        MarketConfig memory market = registry.getMarket(mandate.marketId);
        quote = _buildReservationQuote(mandate, market, quantity);
    }

    function createReservation(uint256 mandateId, uint256 quantity, uint256 expectedPayout)
        external
        nonReentrant
        returns (uint256 reservationId)
    {
        _requireConfiguredAndRiskEnabled();
        Mandate storage mandate = _requireMandate(mandateId);
        if (mandate.status != MandateStatus.Open) revert InvalidMandateStatus();
        MarketConfig memory market = registry.requireEnabledMarket(mandate.marketId);
        if (block.timestamp > mandate.mandateExpiry - mandate.reservationDuration) {
            revert ReservationDurationUnavailable();
        }

        ReservationQuote memory quote = _buildReservationQuote(mandate, market, quantity);
        if (quote.payout != expectedPayout) revert ExpectedPayoutMismatch();
        if (quote.eligibility == ReservationEligibility.InsufficientPayoutBudget) {
            revert InsufficientPayoutBudget();
        }
        if (quote.bondAmount == 0) revert ZeroBond();

        reservationId = nextReservationId++;
        uint64 createdAt = uint64(block.timestamp);
        uint64 deliveryDeadline = createdAt + mandate.reservationDuration;
        _reservations[reservationId] = Reservation({
            id: reservationId,
            mandateId: mandateId,
            solver: msg.sender,
            quantity: quantity,
            lockedPayout: quote.payout,
            bondAmount: quote.bondAmount,
            createdAt: createdAt,
            deliveryDeadline: deliveryDeadline,
            status: ReservationStatus.Active
        });
        mandate.reservedAmount += quantity;
        vault.lock(mandateId, market.settlementToken, quote.payout);
        vault.collectBond(reservationId, market.settlementToken, msg.sender, quote.bondAmount);

        emit ReservationCreated(
            reservationId, mandateId, msg.sender, quantity, quote.payout, quote.bondAmount, deliveryDeadline
        );
    }

    function expireReservation(uint256 reservationId) external nonReentrant {
        Reservation storage reservation = _requireReservation(reservationId);
        if (reservation.status != ReservationStatus.Active) revert ReservationAlreadyResolved();
        if (block.timestamp < reservation.deliveryDeadline) revert ReservationNotExpired();

        Mandate storage mandate = _requireMandate(reservation.mandateId);
        address settlementToken = _mandateSettlementTokens[reservation.mandateId];
        reservation.status = ReservationStatus.Expired;
        mandate.reservedAmount -= reservation.quantity;
        vault.unlock(reservation.mandateId, settlementToken, reservation.lockedPayout);
        vault.forfeitBond(reservationId, settlementToken, reservation.solver, mandate.buyer, reservation.bondAmount);

        emit ReservationExpired(
            reservationId, reservation.mandateId, reservation.solver, reservation.quantity, reservation.lockedPayout
        );
        emit ReservationBondForfeited(reservationId, mandate.buyer, settlementToken, reservation.bondAmount);
    }

    function getReservation(uint256 reservationId) external view returns (Reservation memory) {
        return _requireReservation(reservationId);
    }

    function getReservationRequirements(uint256 reservationId)
        external
        view
        returns (MarketConfig memory market, address deliveryWallet, address settlementToken)
    {
        Reservation storage reservation = _requireReservation(reservationId);
        Mandate storage mandate = _requireMandate(reservation.mandateId);
        market = registry.getMarket(mandate.marketId);
        deliveryWallet = mandate.deliveryWallet;
        settlementToken = _mandateSettlementTokens[reservation.mandateId];
    }

    function getMandate(uint256 mandateId) external view returns (Mandate memory) {
        return _requireMandate(mandateId);
    }

    function auditMandate(uint256 mandateId)
        external
        view
        returns (Mandate memory mandate, VaultAccount memory account, bool quantityReconciles, bool budgetReconciles)
    {
        mandate = _requireMandate(mandateId);
        account = vault.getAccount(mandateId);
        quantityReconciles = mandate.acquiredAmount + mandate.reservedAmount <= mandate.targetAmount;
        budgetReconciles = account.funded == account.spent + account.reserved + account.free + account.refunded;
    }

    function _requireConfiguredAndRiskEnabled() private view {
        if (address(vault) == address(0)) revert ProtocolNotConfigured();
        if (protocolPaused) revert ProtocolPaused();
    }

    function _buildReservationQuote(Mandate storage mandate, MarketConfig memory market, uint256 quantity)
        private
        view
        returns (ReservationQuote memory quote)
    {
        uint256 startPosition = mandate.acquiredAmount + mandate.reservedAmount;
        uint256 payout = PricingLibrary.quote(
            mandate.pricingMode,
            mandate.targetAmount,
            market.foreignTokenDecimals,
            mandate.startPrice,
            mandate.endPrice,
            startPosition,
            quantity
        );
        uint256 calculatedBond = Math.mulDiv(payout, bondRateBps, BPS_DENOMINATOR);
        uint256 bondAmount = Math.min(calculatedBond, bondCap);
        if (bondAmount == 0) revert ZeroBond();
        uint64 eligibleUntil = mandate.mandateExpiry - mandate.reservationDuration;

        ReservationEligibility eligibility = ReservationEligibility.Eligible;
        if (protocolPaused) {
            eligibility = ReservationEligibility.ProtocolPaused;
        } else if (!market.enabled) {
            eligibility = ReservationEligibility.MarketDisabled;
        } else if (mandate.status != MandateStatus.Open) {
            eligibility = ReservationEligibility.MandateNotOpen;
        } else if (block.timestamp > eligibleUntil) {
            eligibility = ReservationEligibility.InsufficientLifetime;
        } else if (vault.getAccount(mandate.id).free < payout) {
            eligibility = ReservationEligibility.InsufficientPayoutBudget;
        }

        quote = ReservationQuote({
            mandateId: mandate.id,
            startPosition: startPosition,
            quantity: quantity,
            endPosition: startPosition + quantity,
            payout: payout,
            bondAmount: bondAmount,
            reservationDuration: mandate.reservationDuration,
            eligibleUntil: eligibleUntil,
            sourceChainKey: market.sourceChainKey,
            foreignToken: market.foreignToken,
            deliveryWallet: mandate.deliveryWallet,
            settlementToken: _mandateSettlementTokens[mandate.id],
            eligibility: eligibility
        });
    }

    /// @dev Module 4's proof-gated transition. It is intentionally unreachable from this module's production ABI.
    function _settleReservation(uint256 reservationId) internal {
        Reservation storage reservation = _requireReservation(reservationId);
        if (reservation.status != ReservationStatus.Active) revert ReservationAlreadyResolved();
        Mandate storage mandate = _requireMandate(reservation.mandateId);
        address settlementToken = _mandateSettlementTokens[reservation.mandateId];
        reservation.status = ReservationStatus.Settled;
        mandate.reservedAmount -= reservation.quantity;
        mandate.acquiredAmount += reservation.quantity;
        vault.spend(reservation.mandateId, settlementToken, reservation.solver, reservation.lockedPayout);
        vault.returnBond(reservationId, settlementToken, reservation.solver, reservation.bondAmount);
    }

    function _requireMandate(uint256 mandateId) private view returns (Mandate storage mandate) {
        mandate = _mandates[mandateId];
        if (mandate.buyer == address(0)) revert MandateNotFound();
    }

    function _requireReservation(uint256 reservationId) private view returns (Reservation storage reservation) {
        reservation = _reservations[reservationId];
        if (reservation.solver == address(0)) revert ReservationNotFound();
    }

    function _requireBuyer(Mandate storage mandate) private view {
        if (msg.sender != mandate.buyer) revert NotMandateBuyer();
    }
}
