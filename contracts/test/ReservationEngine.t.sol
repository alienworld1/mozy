// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {TestBase} from "./TestBase.sol";
import {MarketRegistry} from "../src/MarketRegistry.sol";
import {MozyMarket} from "../src/MozyMarket.sol";
import {SettlementVault} from "../src/SettlementVault.sol";
import {
    PricingMode,
    MandateStatus,
    ReservationStatus,
    ReservationEligibility,
    MarketConfig,
    Mandate,
    VaultAccount,
    Reservation,
    ReservationQuote,
    BondEscrow
} from "../src/ProtocolTypes.sol";
import {
    ProtocolPaused,
    MarketNotEnabled,
    InvalidMandateStatus,
    QuoteExceedsTarget,
    ExpectedPayoutMismatch,
    InsufficientBondAllowance,
    ReservationNotExpired,
    ReservationAlreadyResolved,
    ReservationNotFound,
    ReservationDurationUnavailable,
    UnexpectedTokenBalanceDelta,
    InsufficientBondBalance,
    ZeroBond
} from "../src/ProtocolErrors.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {ShortTransferToken} from "./mocks/ShortTransferToken.sol";
import {ReentrantToken} from "./mocks/ReentrantToken.sol";
import {ClockedChainInfo} from "./mocks/ClockedChainInfo.sol";

contract ReservationEngineTest is TestBase {
    address private constant ADMIN = address(0xA11CE);
    address private constant BUYER = address(0xB0B);
    address private constant SOLVER_A = address(0x5017A);
    address private constant SOLVER_B = address(0x5017B);
    address private constant OTHER = address(0xCAFE);
    address private constant DELIVERY_WALLET = address(0xD3110);
    address private constant FOREIGN_TOKEN = address(0x1234);
    uint256 private constant UNIT = 1e18;
    uint256 private constant BOND_RATE_BPS = 100;
    uint256 private constant BOND_CAP = 10 * UNIT;

    MockERC20 private token;
    MarketRegistry private registry;
    MozyMarket private market;
    SettlementVault private vault;

    function setUp() external {
        token = new MockERC20();
        (registry, market, vault) = _deploy(address(token));
        token.mint(BUYER, 1_000 * UNIT);
        token.mint(SOLVER_A, 100 * UNIT);
        token.mint(SOLVER_B, 100 * UNIT);
        vm.prank(BUYER);
        token.approve(address(vault), type(uint256).max);
        vm.prank(SOLVER_A);
        token.approve(address(vault), type(uint256).max);
        vm.prank(SOLVER_B);
        token.approve(address(vault), type(uint256).max);
    }

    function testQuoteAndPartialReservationLockCanonicalTerms() external {
        uint256 mandateId = _openRangeMandate(4 * UNIT);
        ReservationQuote memory quote = market.quoteReservation(mandateId, UNIT);
        assertEq(quote.mandateId, mandateId);
        assertEq(quote.startPosition, 0);
        assertEq(quote.endPosition, UNIT);
        assertEq(quote.quantity, UNIT);
        assertEq(quote.bondAmount, quote.payout * BOND_RATE_BPS / 10_000);
        assertEq(uint256(quote.eligibility), uint256(ReservationEligibility.Eligible));
        assertEq(quote.sourceChainKey, 1);
        assertEq(quote.foreignToken, FOREIGN_TOKEN);
        assertEq(quote.deliveryWallet, DELIVERY_WALLET);
        assertEq(quote.settlementToken, address(token));

        uint256 solverBefore = token.balanceOf(SOLVER_A);
        vm.prank(SOLVER_A);
        uint256 reservationId = market.createReservation(mandateId, UNIT, quote.payout);

        Reservation memory reservation = market.getReservation(reservationId);
        Mandate memory mandate = market.getMandate(mandateId);
        VaultAccount memory account = vault.getAccount(mandateId);
        BondEscrow memory escrow = vault.getBondEscrow(reservationId);
        assertEq(reservationId, 1);
        assertEq(reservation.solver, SOLVER_A);
        assertEq(reservation.quantity, UNIT);
        assertEq(reservation.lockedPayout, quote.payout);
        assertEq(reservation.bondAmount, quote.bondAmount);
        assertEq(reservation.deliveryDeadline, reservation.createdAt + mandate.reservationDuration);
        assertEq(reservation.sourceStartHeight, reservation.createdAt + 1);
        assertEq(reservation.sourceEndHeight, reservation.createdAt + 10);
        assertEq(reservation.expiryEligibleHeight, reservation.createdAt + 15);
        assertEq(uint256(reservation.status), uint256(ReservationStatus.Active));
        assertEq(mandate.reservedAmount, UNIT);
        assertEq(account.reserved, quote.payout);
        assertEq(account.free, account.funded - quote.payout);
        assertEq(escrow.token, address(token));
        assertEq(escrow.solver, SOLVER_A);
        assertEq(escrow.amount, quote.bondAmount);
        assertTrue(!escrow.resolved);
        assertEq(solverBefore - token.balanceOf(SOLVER_A), quote.bondAmount);
        assertEq(vault.accountedTokenBalance(address(token)), account.funded + quote.bondAmount);
        assertEq(vault.unresolvedBondBalance(address(token)), quote.bondAmount);
        assertTrue(vault.isSolvent(address(token)));

        (MarketConfig memory requirements, address recipient, address settlementToken) =
            market.getReservationRequirements(reservationId);
        assertEq(requirements.sourceChainKey, 1);
        assertEq(requirements.foreignToken, FOREIGN_TOKEN);
        assertEq(requirements.foreignTokenDecimals, 18);
        assertEq(requirements.settlementTokenDecimals, 18);
        assertEq(recipient, DELIVERY_WALLET);
        assertEq(settlementToken, address(token));
    }

    function testStaleRangeQuoteAndOverReservationRollbackCompletely() external {
        uint256 mandateId = _openRangeMandate(2 * UNIT);
        ReservationQuote memory stale = market.quoteReservation(mandateId, UNIT);
        vm.prank(SOLVER_A);
        market.createReservation(mandateId, UNIT, stale.payout);
        uint256 nextId = market.nextReservationId();
        uint256 solverBefore = token.balanceOf(SOLVER_B);

        vm.prank(SOLVER_B);
        vm.expectRevert(ExpectedPayoutMismatch.selector);
        market.createReservation(mandateId, UNIT, stale.payout);
        assertEq(market.nextReservationId(), nextId);
        assertEq(token.balanceOf(SOLVER_B), solverBefore);

        ReservationQuote memory finalQuote = market.quoteReservation(mandateId, UNIT);
        vm.prank(SOLVER_B);
        market.createReservation(mandateId, UNIT, finalQuote.payout);
        vm.prank(SOLVER_B);
        vm.expectRevert(QuoteExceedsTarget.selector);
        market.createReservation(mandateId, 1, 1);
        _assertMandateReconciles(mandateId);
    }

    function testPauseDisableAndMandateStatusBlockNewRiskButNotExpiry() external {
        uint256 mandateId = _openRangeMandate(3 * UNIT);
        ReservationQuote memory quote = market.quoteReservation(mandateId, UNIT);
        vm.prank(SOLVER_A);
        uint256 reservationId = market.createReservation(mandateId, UNIT, quote.payout);

        vm.prank(ADMIN);
        market.setProtocolPaused(true);
        assertEq(
            uint256(market.quoteReservation(mandateId, UNIT).eligibility),
            uint256(ReservationEligibility.ProtocolPaused)
        );
        uint256 pausedPayout = market.quoteReservation(mandateId, UNIT).payout;
        vm.prank(SOLVER_B);
        vm.expectRevert(ProtocolPaused.selector);
        market.createReservation(mandateId, UNIT, pausedPayout);
        vm.prank(ADMIN);
        market.setProtocolPaused(false);
        vm.prank(ADMIN);
        registry.setMarketEnabled(1, false);
        assertEq(
            uint256(market.quoteReservation(mandateId, UNIT).eligibility),
            uint256(ReservationEligibility.MarketDisabled)
        );
        vm.prank(SOLVER_B);
        vm.expectRevert(MarketNotEnabled.selector);
        market.createReservation(mandateId, UNIT, 1);

        vm.warp(market.getReservation(reservationId).deliveryDeadline);
        vm.prank(OTHER);
        market.expireReservation(reservationId);
        assertEq(uint256(market.getReservation(reservationId).status), uint256(ReservationStatus.Expired));
    }

    function testCancellationRefundAndPermissionlessExpiryPreserveCommitment() external {
        uint256 mandateId = _openRangeMandate(4 * UNIT);
        ReservationQuote memory firstQuote = market.quoteReservation(mandateId, UNIT);
        vm.prank(SOLVER_A);
        uint256 firstId = market.createReservation(mandateId, UNIT, firstQuote.payout);
        ReservationQuote memory secondQuote = market.quoteReservation(mandateId, UNIT);
        vm.prank(SOLVER_B);
        uint256 secondId = market.createReservation(mandateId, UNIT, secondQuote.payout);

        VaultAccount memory beforeCancel = vault.getAccount(mandateId);
        vm.prank(BUYER);
        market.pauseMandate(mandateId);
        vm.prank(BUYER);
        market.cancelMandate(mandateId);
        vm.prank(BUYER);
        market.refundMandate(mandateId, beforeCancel.free);
        assertEq(vault.getAccount(mandateId).reserved, firstQuote.payout + secondQuote.payout);

        uint256 buyerBefore = token.balanceOf(BUYER);
        vm.warp(market.getReservation(firstId).deliveryDeadline);
        vm.prank(OTHER);
        market.expireReservation(firstId);
        assertEq(token.balanceOf(BUYER) - buyerBefore, firstQuote.bondAmount);
        assertEq(uint256(market.getMandate(mandateId).status), uint256(MandateStatus.Cancelled));
        assertEq(uint256(market.getReservation(secondId).status), uint256(ReservationStatus.Active));
        assertEq(vault.getAccount(mandateId).reserved, secondQuote.payout);
        assertEq(vault.getAccount(mandateId).free, firstQuote.payout);

        vm.expectRevert(ReservationAlreadyResolved.selector);
        market.expireReservation(firstId);
        _assertMandateReconciles(mandateId);
    }

    function testDeadlineBoundaryAndMissingAllowanceAreAtomic() external {
        uint256 mandateId = _openRangeMandate(2 * UNIT);
        ReservationQuote memory quote = market.quoteReservation(mandateId, UNIT);
        vm.prank(SOLVER_A);
        token.approve(address(vault), 0);
        vm.prank(SOLVER_A);
        vm.expectRevert(InsufficientBondAllowance.selector);
        market.createReservation(mandateId, UNIT, quote.payout);
        assertEq(market.nextReservationId(), 1);
        assertEq(market.getMandate(mandateId).reservedAmount, 0);

        vm.prank(SOLVER_A);
        token.approve(address(vault), type(uint256).max);
        vm.warp(quote.eligibleUntil);
        vm.prank(SOLVER_A);
        uint256 reservationId = market.createReservation(mandateId, UNIT, quote.payout);
        Reservation memory reservation = market.getReservation(reservationId);
        vm.warp(reservation.deliveryDeadline - 1);
        vm.expectRevert(ReservationNotExpired.selector);
        market.expireReservation(reservationId);
        vm.warp(reservation.deliveryDeadline);
        market.expireReservation(reservationId);
    }

    function testCreationOneSecondAfterEligibleUntilFails() external {
        uint256 mandateId = _openRangeMandate(2 * UNIT);
        ReservationQuote memory quote = market.quoteReservation(mandateId, UNIT);
        vm.warp(quote.eligibleUntil + 1);
        vm.prank(SOLVER_A);
        vm.expectRevert(ReservationDurationUnavailable.selector);
        market.createReservation(mandateId, UNIT, quote.payout);
    }

    function testShortBondTransferAndReentrantCallbackCannotPartiallyCreate() external {
        ShortTransferToken shortToken = new ShortTransferToken();
        shortToken.setShortTransfers(false);
        (, MozyMarket shortMarket, SettlementVault shortVault) = _deploy(address(shortToken));
        shortToken.mint(BUYER, 100 * UNIT);
        shortToken.mint(SOLVER_A, 10 * UNIT);
        vm.prank(BUYER);
        shortToken.approve(address(shortVault), type(uint256).max);
        vm.prank(SOLVER_A);
        shortToken.approve(address(shortVault), type(uint256).max);
        uint256 shortMandate = _openLimitMandateOn(shortMarket, UNIT);
        shortToken.setShortTransfers(true);
        ReservationQuote memory shortQuote = shortMarket.quoteReservation(shortMandate, UNIT);
        vm.prank(SOLVER_A);
        vm.expectRevert(UnexpectedTokenBalanceDelta.selector);
        shortMarket.createReservation(shortMandate, UNIT, shortQuote.payout);
        assertEq(shortMarket.nextReservationId(), 1);
        assertEq(shortMarket.getMandate(shortMandate).reservedAmount, 0);
        assertEq(shortVault.getAccount(shortMandate).reserved, 0);
        shortToken.setShortTransfers(false);
        vm.prank(SOLVER_A);
        uint256 shortReservation = shortMarket.createReservation(shortMandate, UNIT, shortQuote.payout);
        shortToken.setShortTransfers(true);
        vm.warp(shortMarket.getReservation(shortReservation).deliveryDeadline);
        vm.expectRevert(UnexpectedTokenBalanceDelta.selector);
        shortMarket.expireReservation(shortReservation);
        assertEq(uint256(shortMarket.getReservation(shortReservation).status), uint256(ReservationStatus.Active));
        assertEq(shortMarket.getMandate(shortMandate).reservedAmount, UNIT);
        assertEq(shortVault.getAccount(shortMandate).reserved, shortQuote.payout);
        assertTrue(!shortVault.getBondEscrow(shortReservation).resolved);

        ReentrantToken reentrant = new ReentrantToken();
        (, MozyMarket reentrantMarket, SettlementVault reentrantVault) = _deploy(address(reentrant));
        reentrant.mint(BUYER, 100 * UNIT);
        reentrant.mint(SOLVER_A, 10 * UNIT);
        vm.prank(BUYER);
        reentrant.approve(address(reentrantVault), type(uint256).max);
        vm.prank(SOLVER_A);
        reentrant.approve(address(reentrantVault), type(uint256).max);
        uint256 reentrantMandate = _openLimitMandateOn(reentrantMarket, UNIT);
        ReservationQuote memory reentrantQuote = reentrantMarket.quoteReservation(reentrantMandate, UNIT);
        reentrant.setCallback(
            address(reentrantMarket),
            abi.encodeCall(reentrantMarket.createReservation, (reentrantMandate, UNIT, reentrantQuote.payout))
        );
        vm.prank(SOLVER_A);
        uint256 reservationId = reentrantMarket.createReservation(reentrantMandate, UNIT, reentrantQuote.payout);
        assertEq(reservationId, 1);
        assertEq(reentrantMarket.nextReservationId(), 2);
    }

    function testUnknownReservationReverts() external {
        vm.expectRevert(ReservationNotFound.selector);
        market.getReservation(1);
    }

    function testBondPolicyRoundsCapsAndRejectsZero() external {
        token.mint(BUYER, 3_000 * UNIT);
        vm.prank(BUYER);
        uint256 mandateId = market.createMandate(
            1,
            DELIVERY_WALLET,
            3 * UNIT,
            PricingMode.Limit,
            1_000 * UNIT,
            1_000 * UNIT,
            uint64(block.timestamp + 1 days),
            1 hours
        );
        vm.prank(BUYER);
        market.fundMandate(mandateId, 3_000 * UNIT);
        assertEq(market.quoteReservation(mandateId, UNIT / 2).bondAmount, 5 * UNIT);
        assertEq(market.quoteReservation(mandateId, UNIT).bondAmount, BOND_CAP);
        assertEq(market.quoteReservation(mandateId, 2 * UNIT).bondAmount, BOND_CAP);

        uint256 tinyMandate = _openLimitMandate(UNIT);
        vm.expectRevert(ZeroBond.selector);
        market.quoteReservation(tinyMandate, 1);
    }

    function testInsufficientSolverBalanceRollsBack() external {
        uint256 mandateId = _openLimitMandate(UNIT);
        ReservationQuote memory quote = market.quoteReservation(mandateId, UNIT);
        vm.prank(OTHER);
        token.approve(address(vault), quote.bondAmount);
        vm.prank(OTHER);
        vm.expectRevert(InsufficientBondBalance.selector);
        market.createReservation(mandateId, UNIT, quote.payout);
        assertEq(market.nextReservationId(), 1);
        assertEq(vault.getAccount(mandateId).reserved, 0);
    }

    function testReservationsExpireOutOfOrderAcrossMandatesAndTerminalStates() external {
        uint256 firstMandate = _openLimitMandate(3 * UNIT);
        uint256 secondMandate = _openLimitMandate(2 * UNIT);
        ReservationQuote memory firstQuote = market.quoteReservation(firstMandate, UNIT);
        vm.prank(SOLVER_A);
        uint256 firstId = market.createReservation(firstMandate, UNIT, firstQuote.payout);
        ReservationQuote memory secondQuote = market.quoteReservation(firstMandate, UNIT);
        vm.prank(SOLVER_B);
        uint256 secondId = market.createReservation(firstMandate, UNIT, secondQuote.payout);
        ReservationQuote memory isolatedQuote = market.quoteReservation(secondMandate, UNIT);
        vm.prank(SOLVER_A);
        uint256 isolatedId = market.createReservation(secondMandate, UNIT, isolatedQuote.payout);

        vm.prank(BUYER);
        market.pauseMandate(firstMandate);
        vm.warp(market.getMandate(secondMandate).mandateExpiry);
        market.expireMandate(secondMandate);
        market.expireReservation(secondId);
        market.expireReservation(isolatedId);
        market.expireReservation(firstId);

        assertEq(market.getMandate(firstMandate).reservedAmount, 0);
        assertEq(market.getMandate(secondMandate).reservedAmount, 0);
        assertEq(uint256(market.getMandate(firstMandate).status), uint256(MandateStatus.Paused));
        assertEq(uint256(market.getMandate(secondMandate).status), uint256(MandateStatus.Expired));
        assertEq(vault.unresolvedBondBalance(address(token)), 0);
        _assertMandateReconciles(firstMandate);
        _assertMandateReconciles(secondMandate);
    }

    function testFuzzReservationQuantityAndBondReconcile(uint96 rawQuantity) external {
        uint256 quantity = uint256(rawQuantity) % UNIT + 100;
        uint256 mandateId = _openLimitMandate(2 * UNIT);
        ReservationQuote memory quote = market.quoteReservation(mandateId, quantity);
        vm.prank(SOLVER_A);
        market.createReservation(mandateId, quantity, quote.payout);
        assertEq(quote.payout, quantity);
        assertEq(quote.bondAmount, quantity / 100);
        _assertMandateReconciles(mandateId);
    }

    function _openRangeMandate(uint256 target) private returns (uint256 mandateId) {
        vm.prank(BUYER);
        mandateId = market.createMandate(
            1, DELIVERY_WALLET, target, PricingMode.Range, 2 * UNIT, 4 * UNIT, uint64(block.timestamp + 1 days), 1 hours
        );
        uint256 requiredFunding = market.getMandate(mandateId).requiredFunding;
        vm.prank(BUYER);
        market.fundMandate(mandateId, requiredFunding);
    }

    function _openLimitMandate(uint256 target) private returns (uint256) {
        return _openLimitMandateOn(market, target);
    }

    function _openLimitMandateOn(MozyMarket targetMarket, uint256 target) private returns (uint256 mandateId) {
        vm.prank(BUYER);
        mandateId = targetMarket.createMandate(
            1, DELIVERY_WALLET, target, PricingMode.Limit, UNIT, UNIT, uint64(block.timestamp + 1 days), 1 hours
        );
        vm.prank(BUYER);
        targetMarket.fundMandate(mandateId, target);
    }

    function _deploy(address settlementToken)
        private
        returns (MarketRegistry deployedRegistry, MozyMarket deployedMarket, SettlementVault deployedVault)
    {
        deployedRegistry = new MarketRegistry(ADMIN, 1, FOREIGN_TOKEN, 18, settlementToken, 18, keccak256("test"));
        deployedMarket = new MozyMarket(ADMIN, deployedRegistry, new ClockedChainInfo(), 10, 5, BOND_RATE_BPS, BOND_CAP);
        deployedVault = new SettlementVault(address(deployedMarket));
        vm.startPrank(ADMIN);
        deployedMarket.configureVault(deployedVault);
        deployedRegistry.configureReleaseMarket(
            MarketConfig({
                sourceChainKey: 1,
                foreignToken: FOREIGN_TOKEN,
                foreignTokenDecimals: 18,
                settlementToken: settlementToken,
                settlementTokenDecimals: 18,
                enabled: true
            })
        );
        vm.stopPrank();
    }

    function _assertMandateReconciles(uint256 mandateId) private view {
        (Mandate memory mandate, VaultAccount memory account, bool quantityOk, bool budgetOk) =
            market.auditMandate(mandateId);
        assertTrue(quantityOk);
        assertTrue(budgetOk);
        assertTrue(mandate.acquiredAmount + mandate.reservedAmount <= mandate.targetAmount);
        assertTrue(account.spent + account.reserved <= account.funded);
        assertTrue(vault.isSolvent(address(token)));
    }
}

contract ReservationInvariantHandler {
    uint256 private constant UNIT = 1e18;

    MockERC20 public immutable token;
    MozyMarket public immutable market;
    SettlementVault public immutable vault;
    uint256 public immutable mandateId;

    constructor() {
        token = new MockERC20();
        MarketRegistry registry =
            new MarketRegistry(address(this), 1, address(0x1234), 18, address(token), 18, keccak256("invariant"));
        market = new MozyMarket(address(this), registry, new ClockedChainInfo(), 10, 5, 100, 10 * UNIT);
        vault = new SettlementVault(address(market));
        market.configureVault(vault);
        registry.configureReleaseMarket(
            MarketConfig({
                sourceChainKey: 1,
                foreignToken: address(0x1234),
                foreignTokenDecimals: 18,
                settlementToken: address(token),
                settlementTokenDecimals: 18,
                enabled: true
            })
        );
        token.mint(address(this), 1_000 * UNIT);
        token.approve(address(vault), type(uint256).max);
        mandateId = market.createMandate(
            1, address(0xD3110), 100 * UNIT, PricingMode.Limit, UNIT, UNIT, uint64(block.timestamp + 30 days), 1 days
        );
        market.fundMandate(mandateId, 100 * UNIT);
    }

    function reserve(uint96 rawQuantity) external {
        Mandate memory mandate = market.getMandate(mandateId);
        uint256 remaining = mandate.targetAmount - mandate.acquiredAmount - mandate.reservedAmount;
        if (remaining < 100) return;
        uint256 quantity = uint256(rawQuantity) % (remaining - 99) + 100;
        ReservationQuote memory quote = market.quoteReservation(mandateId, quantity);
        market.createReservation(mandateId, quantity, quote.payout);
    }
}

contract ReservationInvariantTest is TestBase {
    ReservationInvariantHandler private handler;
    address[] private _targetContracts;

    function setUp() external {
        handler = new ReservationInvariantHandler();
        _targetContracts.push(address(handler));
    }

    function targetContracts() external view returns (address[] memory) {
        return _targetContracts;
    }

    function invariantReservationAndVaultAccountingAlwaysReconcile() external view {
        MozyMarket market = handler.market();
        SettlementVault vault = handler.vault();
        MockERC20 token = handler.token();
        uint256 mandateId = handler.mandateId();
        (Mandate memory mandate, VaultAccount memory account, bool quantityOk, bool budgetOk) =
            market.auditMandate(mandateId);
        assertTrue(quantityOk);
        assertTrue(budgetOk);
        assertTrue(mandate.acquiredAmount + mandate.reservedAmount <= mandate.targetAmount);
        assertTrue(account.spent + account.reserved <= account.funded);
        assertEq(
            vault.accountedTokenBalance(address(token)),
            account.free + account.reserved + vault.unresolvedBondBalance(address(token))
        );
        assertTrue(vault.isSolvent(address(token)));
    }
}
