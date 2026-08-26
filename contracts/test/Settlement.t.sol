// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {TestBase} from "./TestBase.sol";
import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol";
import {INativeQueryVerifier} from "@gluwa/usc-contracts/contracts/write-ability/INativeQueryVerifier.sol";
import {MarketRegistry} from "../src/MarketRegistry.sol";
import {MozyMarket} from "../src/MozyMarket.sol";
import {MozySettlement} from "../src/MozySettlement.sol";
import {SettlementVault} from "../src/SettlementVault.sol";
import {
    PricingMode,
    MandateStatus,
    ReservationStatus,
    MarketConfig,
    Mandate,
    VaultAccount,
    Reservation,
    ReservationQuote,
    BondEscrow
} from "../src/ProtocolTypes.sol";
import {
    UnauthorizedSettlementOperator,
    IncompatibleReservationState,
    SourceChainMismatch,
    ReceiptAlreadyConsumed,
    AttestcoinVerificationFailed,
    SourceReceiptUnsuccessful,
    TransactionTargetMismatch,
    TransferCallMismatch,
    WrongDeliverySender,
    WrongDeliveryRecipient,
    WrongDeliveryToken,
    AmbiguousTransfer,
    Underdelivery,
    InvalidDeliveryTiming,
    SourceWindowStillOpen,
    UnexpectedTokenBalanceDelta
} from "../src/ProtocolErrors.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {ShortTransferToken} from "./mocks/ShortTransferToken.sol";
import {MockChainInfo} from "./mocks/MockChainInfo.sol";
import {MockAttestcoinVerifier} from "./mocks/MockAttestcoinVerifier.sol";

contract SettlementTest is TestBase {
    address private constant ADMIN = address(0xA11CE);
    address private constant BUYER = address(0xB0B);
    address private constant SOLVER = address(0x5017A);
    address private constant RELAYER = address(0xCAFE);
    address private constant DELIVERY_WALLET = address(0xD3110);
    address private constant FOREIGN_TOKEN = address(0x1234);
    uint256 private constant UNIT = 1e18;
    bytes32 private constant TRANSFER_TOPIC = keccak256("Transfer(address,address,uint256)");

    MockERC20 private token;
    MockChainInfo private chainInfo;
    MockAttestcoinVerifier private verifier;
    MarketRegistry private registry;
    MozyMarket private market;
    SettlementVault private vault;
    MozySettlement private settlement;

    function setUp() external {
        token = new MockERC20();
        chainInfo = new MockChainInfo(100);
        verifier = new MockAttestcoinVerifier();
        registry = new MarketRegistry(ADMIN, 1, FOREIGN_TOKEN, 18, address(token), 18, keccak256("test"));
        market = new MozyMarket(ADMIN, registry, chainInfo, 20, 10, 100, 10 * UNIT);
        vault = new SettlementVault(address(market));
        settlement = new MozySettlement(market, verifier);
        vm.startPrank(ADMIN);
        market.configureVault(vault);
        market.configureSettlementOperator(address(settlement));
        registry.configureReleaseMarket(_marketConfig(true));
        vm.stopPrank();

        token.mint(BUYER, 1_000 * UNIT);
        token.mint(SOLVER, 100 * UNIT);
        vm.prank(BUYER);
        token.approve(address(vault), type(uint256).max);
        vm.prank(SOLVER);
        token.approve(address(vault), type(uint256).max);
    }

    function testPermissionlessExactSettlementPaysOnlyBoundSolver() external {
        (uint256 mandateId, uint256 reservationId, ReservationQuote memory quote) = _openReservation(UNIT, UNIT);
        uint256 solverBefore = token.balanceOf(SOLVER);
        uint256 relayerBefore = token.balanceOf(RELAYER);
        bytes memory payload = _payload(SOLVER, DELIVERY_WALLET, UNIT, FOREIGN_TOKEN, 1, 1);

        vm.prank(RELAYER);
        bytes32 replayIdentity = settlement.settle(reservationId, 1, 101, payload, _merkleProof(), _continuityProof());

        Reservation memory reservation = market.getReservation(reservationId);
        Mandate memory mandate = market.getMandate(mandateId);
        VaultAccount memory account = vault.getAccount(mandateId);
        BondEscrow memory escrow = vault.getBondEscrow(reservationId);
        assertEq(uint256(reservation.status), uint256(ReservationStatus.Settled));
        assertEq(mandate.reservedAmount, 0);
        assertEq(mandate.acquiredAmount, UNIT);
        assertEq(account.reserved, 0);
        assertEq(account.spent, quote.payout);
        assertEq(token.balanceOf(SOLVER) - solverBefore, quote.payout + quote.bondAmount);
        assertEq(token.balanceOf(RELAYER), relayerBefore);
        assertTrue(escrow.resolved);
        assertEq(settlement.receiptReservation(replayIdentity), reservationId);
        assertTrue(settlement.isReceiptConsumed(replayIdentity));
        assertTrue(vault.isSolvent(address(token)));
    }

    function testOverdeliveryCreditsOnlyReservationAndFillsMandate() external {
        (uint256 mandateId, uint256 reservationId, ReservationQuote memory quote) = _openReservation(UNIT, UNIT);
        vm.prank(RELAYER);
        settlement.settle(
            reservationId,
            1,
            120,
            _payload(SOLVER, DELIVERY_WALLET, UNIT + 1, FOREIGN_TOKEN, 1, 1),
            _merkleProof(),
            _continuityProof()
        );
        Mandate memory mandate = market.getMandate(mandateId);
        assertEq(mandate.acquiredAmount, UNIT);
        assertEq(uint256(mandate.status), uint256(MandateStatus.Filled));
        assertEq(vault.getAccount(mandateId).spent, quote.payout);
    }

    function testFuzzOverdeliveryAndRelayerNeverChangeLockedTerms(uint96 extraAmount, address proofSubmitter)
        external
    {
        uint256 delivered = UNIT + uint256(extraAmount);
        (uint256 mandateId, uint256 reservationId, ReservationQuote memory quote) = _openReservation(UNIT, UNIT);
        vm.prank(proofSubmitter);
        settlement.settle(
            reservationId,
            1,
            101,
            _payload(SOLVER, DELIVERY_WALLET, delivered, FOREIGN_TOKEN, 1, 1),
            _merkleProof(),
            _continuityProof()
        );
        assertEq(market.getMandate(mandateId).acquiredAmount, UNIT);
        assertEq(vault.getAccount(mandateId).spent, quote.payout);
        assertEq(uint256(market.getReservation(reservationId).status), uint256(ReservationStatus.Settled));
    }

    function testSourceHeightBoundariesAndLateProofDuringGrace() external {
        (, uint256 firstId,) = _openReservation(3 * UNIT, UNIT);
        vm.prank(RELAYER);
        settlement.settle(
            firstId,
            1,
            101,
            _payload(SOLVER, DELIVERY_WALLET, UNIT, FOREIGN_TOKEN, 1, 1),
            _merkleProof(),
            _continuityProof()
        );

        chainInfo.setLatestHeight(100);
        (, uint256 secondId,) = _openReservation(3 * UNIT, UNIT);
        Reservation memory second = market.getReservation(secondId);
        vm.warp(second.deliveryDeadline);
        chainInfo.setLatestHeight(second.sourceEndHeight);
        vm.expectRevert(
            abi.encodeWithSelector(SourceWindowStillOpen.selector, second.sourceEndHeight, second.expiryEligibleHeight)
        );
        market.expireReservation(secondId);
        vm.prank(RELAYER);
        settlement.settle(
            secondId,
            1,
            second.sourceEndHeight,
            _payload(SOLVER, DELIVERY_WALLET, UNIT, FOREIGN_TOKEN, 1, 1),
            _merkleProof(),
            _continuityProof()
        );

        chainInfo.setLatestHeight(100);
        (, uint256 earlyId,) = _openReservation(3 * UNIT, UNIT);
        vm.prank(RELAYER);
        vm.expectRevert(InvalidDeliveryTiming.selector);
        settlement.settle(
            earlyId,
            1,
            100,
            _payload(SOLVER, DELIVERY_WALLET, UNIT, FOREIGN_TOKEN, 1, 1),
            _merkleProof(),
            _continuityProof()
        );
        vm.prank(RELAYER);
        vm.expectRevert(InvalidDeliveryTiming.selector);
        settlement.settle(
            earlyId,
            1,
            121,
            _payload(SOLVER, DELIVERY_WALLET, UNIT, FOREIGN_TOKEN, 1, 1),
            _merkleProof(),
            _continuityProof()
        );
    }

    function testExpiryWaitsForAuthenticatedGraceAndThenResolves() external {
        (, uint256 reservationId,) = _openReservation(UNIT, UNIT);
        Reservation memory reservation = market.getReservation(reservationId);
        vm.warp(reservation.deliveryDeadline);
        chainInfo.setLatestHeight(reservation.expiryEligibleHeight - 1);
        vm.expectRevert(
            abi.encodeWithSelector(
                SourceWindowStillOpen.selector, reservation.expiryEligibleHeight - 1, reservation.expiryEligibleHeight
            )
        );
        market.expireReservation(reservationId);
        chainInfo.setLatestHeight(reservation.expiryEligibleHeight);
        vm.prank(RELAYER);
        market.expireReservation(reservationId);
        assertEq(uint256(market.getReservation(reservationId).status), uint256(ReservationStatus.Expired));
    }

    function testReplayAndResolvedReservationCannotMutateAccounting() external {
        (uint256 mandateId, uint256 reservationId,) = _openReservation(2 * UNIT, UNIT);
        bytes memory payload = _payload(SOLVER, DELIVERY_WALLET, UNIT, FOREIGN_TOKEN, 1, 1);
        vm.prank(RELAYER);
        settlement.settle(reservationId, 1, 101, payload, _merkleProof(), _continuityProof());
        VaultAccount memory beforeAccount = vault.getAccount(mandateId);
        vm.prank(RELAYER);
        vm.expectRevert(IncompatibleReservationState.selector);
        settlement.settle(reservationId, 1, 101, payload, _merkleProof(), _continuityProof());
        VaultAccount memory afterAccount = vault.getAccount(mandateId);
        assertEq(afterAccount.spent, beforeAccount.spent);
        assertEq(afterAccount.reserved, beforeAccount.reserved);

        chainInfo.setLatestHeight(100);
        (, uint256 otherId,) = _openReservation(2 * UNIT, UNIT);
        vm.prank(RELAYER);
        vm.expectRevert(ReceiptAlreadyConsumed.selector);
        settlement.settle(otherId, 1, 101, payload, _merkleProof(), _continuityProof());
    }

    function testSemanticAndVerifierFailuresRemainAtomic() external {
        (uint256 mandateId, uint256 reservationId,) = _openReservation(2 * UNIT, UNIT);
        _expectFailure(
            reservationId,
            SourceReceiptUnsuccessful.selector,
            _payload(SOLVER, DELIVERY_WALLET, UNIT, FOREIGN_TOKEN, 0, 1)
        );
        _expectFailure(
            reservationId,
            TransactionTargetMismatch.selector,
            _payload(SOLVER, DELIVERY_WALLET, UNIT, address(0x9999), 1, 1)
        );
        _expectFailure(
            reservationId,
            WrongDeliverySender.selector,
            _payload(address(0x9999), DELIVERY_WALLET, UNIT, FOREIGN_TOKEN, 1, 1)
        );
        _expectFailure(
            reservationId, WrongDeliveryRecipient.selector, _payload(SOLVER, address(0x9999), UNIT, FOREIGN_TOKEN, 1, 1)
        );
        _expectFailure(
            reservationId, Underdelivery.selector, _payload(SOLVER, DELIVERY_WALLET, UNIT - 1, FOREIGN_TOKEN, 1, 1)
        );
        _expectFailure(
            reservationId, WrongDeliveryToken.selector, _payload(SOLVER, DELIVERY_WALLET, UNIT, FOREIGN_TOKEN, 1, 0)
        );
        _expectFailure(
            reservationId, AmbiguousTransfer.selector, _payload(SOLVER, DELIVERY_WALLET, UNIT, FOREIGN_TOKEN, 1, 2)
        );
        _expectFailure(
            reservationId,
            TransferCallMismatch.selector,
            _payloadWithLogAmount(SOLVER, DELIVERY_WALLET, UNIT, UNIT + 1, FOREIGN_TOKEN, 1, 1)
        );
        _expectFailure(reservationId, AttestcoinVerificationFailed.selector, hex"01");
        verifier.configure(false, false, 7);
        _expectFailure(
            reservationId,
            AttestcoinVerificationFailed.selector,
            _payload(SOLVER, DELIVERY_WALLET, UNIT, FOREIGN_TOKEN, 1, 1)
        );

        Reservation memory reservation = market.getReservation(reservationId);
        VaultAccount memory account = vault.getAccount(mandateId);
        assertEq(uint256(reservation.status), uint256(ReservationStatus.Active));
        assertEq(account.reserved, UNIT);
        assertTrue(!vault.getBondEscrow(reservationId).resolved);
    }

    function testWrongSourceChainFailsBeforeVerification() external {
        (, uint256 reservationId,) = _openReservation(UNIT, UNIT);
        vm.prank(RELAYER);
        vm.expectRevert(SourceChainMismatch.selector);
        settlement.settle(
            reservationId,
            2,
            101,
            _payload(SOLVER, DELIVERY_WALLET, UNIT, FOREIGN_TOKEN, 1, 1),
            _merkleProof(),
            _continuityProof()
        );
    }

    function testPausedDisabledAndCancelledParentDoNotBlockSettlement() external {
        (uint256 mandateId, uint256 reservationId,) = _openReservation(2 * UNIT, UNIT);
        vm.prank(BUYER);
        market.pauseMandate(mandateId);
        vm.prank(BUYER);
        market.cancelMandate(mandateId);
        vm.prank(ADMIN);
        market.setProtocolPaused(true);
        vm.prank(ADMIN);
        registry.setMarketEnabled(1, false);

        vm.prank(RELAYER);
        settlement.settle(
            reservationId,
            1,
            101,
            _payload(SOLVER, DELIVERY_WALLET, UNIT, FOREIGN_TOKEN, 1, 1),
            _merkleProof(),
            _continuityProof()
        );
        assertEq(uint256(market.getMandate(mandateId).status), uint256(MandateStatus.Cancelled));
        assertEq(market.getMandate(mandateId).acquiredAmount, UNIT);
    }

    function testOnlyConfiguredSettlementCanReachEconomicTransition() external {
        (, uint256 reservationId,) = _openReservation(UNIT, UNIT);
        vm.expectRevert(UnauthorizedSettlementOperator.selector);
        market.settleReservation(reservationId);
    }

    function testPayoutTransferFailureRollsBackReceiptAndEconomics() external {
        ShortTransferToken shortToken = new ShortTransferToken();
        shortToken.setShortTransfers(false);
        MockChainInfo localChainInfo = new MockChainInfo(100);
        MockAttestcoinVerifier localVerifier = new MockAttestcoinVerifier();
        MarketRegistry localRegistry =
            new MarketRegistry(ADMIN, 1, FOREIGN_TOKEN, 18, address(shortToken), 18, keccak256("short"));
        MozyMarket localMarket = new MozyMarket(ADMIN, localRegistry, localChainInfo, 20, 10, 100, 10 * UNIT);
        SettlementVault localVault = new SettlementVault(address(localMarket));
        MozySettlement localSettlement = new MozySettlement(localMarket, localVerifier);
        vm.startPrank(ADMIN);
        localMarket.configureVault(localVault);
        localMarket.configureSettlementOperator(address(localSettlement));
        localRegistry.configureReleaseMarket(
            MarketConfig({
                sourceChainKey: 1,
                foreignToken: FOREIGN_TOKEN,
                foreignTokenDecimals: 18,
                settlementToken: address(shortToken),
                settlementTokenDecimals: 18,
                enabled: true
            })
        );
        vm.stopPrank();
        shortToken.mint(BUYER, 10 * UNIT);
        shortToken.mint(SOLVER, UNIT);
        vm.prank(BUYER);
        shortToken.approve(address(localVault), type(uint256).max);
        vm.prank(SOLVER);
        shortToken.approve(address(localVault), type(uint256).max);
        vm.prank(BUYER);
        uint256 mandateId = localMarket.createMandate(
            1, DELIVERY_WALLET, UNIT, PricingMode.Limit, UNIT, UNIT, uint64(block.timestamp + 1 days), 100
        );
        vm.prank(BUYER);
        localMarket.fundMandate(mandateId, UNIT);
        ReservationQuote memory quote = localMarket.quoteReservation(mandateId, UNIT);
        vm.prank(SOLVER);
        uint256 reservationId = localMarket.createReservation(mandateId, UNIT, quote.payout);
        shortToken.setShortTransfers(true);

        bytes32 replayIdentity = keccak256(abi.encodePacked(uint256(1), uint64(101), uint256(7)));
        vm.prank(RELAYER);
        vm.expectRevert(UnexpectedTokenBalanceDelta.selector);
        localSettlement.settle(
            reservationId,
            1,
            101,
            _payload(SOLVER, DELIVERY_WALLET, UNIT, FOREIGN_TOKEN, 1, 1),
            _merkleProof(),
            _continuityProof()
        );
        assertEq(uint256(localMarket.getReservation(reservationId).status), uint256(ReservationStatus.Active));
        assertEq(localMarket.getMandate(mandateId).reservedAmount, UNIT);
        assertEq(localVault.getAccount(mandateId).reserved, UNIT);
        assertTrue(!localVault.getBondEscrow(reservationId).resolved);
        assertTrue(!localSettlement.isReceiptConsumed(replayIdentity));
    }

    function _openReservation(uint256 target, uint256 quantity)
        private
        returns (uint256 mandateId, uint256 reservationId, ReservationQuote memory quote)
    {
        vm.prank(BUYER);
        mandateId = market.createMandate(
            1, DELIVERY_WALLET, target, PricingMode.Limit, UNIT, UNIT, uint64(block.timestamp + 1 days), 100
        );
        vm.prank(BUYER);
        market.fundMandate(mandateId, target);
        quote = market.quoteReservation(mandateId, quantity);
        vm.prank(SOLVER);
        reservationId = market.createReservation(mandateId, quantity, quote.payout);
    }

    function _expectFailure(uint256 reservationId, bytes4 selector, bytes memory payload) private {
        vm.prank(RELAYER);
        vm.expectRevert(selector);
        settlement.settle(reservationId, 1, 101, payload, _merkleProof(), _continuityProof());
    }

    function _payload(
        address sender,
        address recipient,
        uint256 amount,
        address transactionTarget,
        uint8 status,
        uint256 matchingLogs
    ) private pure returns (bytes memory) {
        return _payloadWithLogAmount(sender, recipient, amount, amount, transactionTarget, status, matchingLogs);
    }

    function _payloadWithLogAmount(
        address sender,
        address recipient,
        uint256 callAmount,
        uint256 logAmount,
        address transactionTarget,
        uint8 status,
        uint256 matchingLogs
    ) private pure returns (bytes memory) {
        bytes[] memory chunks = new bytes[](3);
        chunks[0] = abi.encode(
            uint64(1),
            uint64(100_000),
            sender,
            false,
            transactionTarget,
            uint256(0),
            abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), recipient, callAmount)
        );
        chunks[1] = bytes("");
        EvmV1Decoder.LogEntryTuple[] memory logs = new EvmV1Decoder.LogEntryTuple[](matchingLogs);
        for (uint256 i; i < matchingLogs; i++) {
            bytes32[] memory topics = new bytes32[](3);
            topics[0] = TRANSFER_TOPIC;
            topics[1] = bytes32(uint256(uint160(sender)));
            topics[2] = bytes32(uint256(uint160(recipient)));
            logs[i] = EvmV1Decoder.LogEntryTuple({address_: FOREIGN_TOKEN, topics: topics, data: abi.encode(logAmount)});
        }
        chunks[2] = abi.encode(status, uint64(50_000), logs, bytes(""));
        return abi.encode(uint8(2), chunks);
    }

    function _merkleProof() private pure returns (INativeQueryVerifier.MerkleProof memory proof) {
        proof.root = keccak256("root");
        proof.siblings = new INativeQueryVerifier.MerkleProofEntry[](0);
    }

    function _continuityProof() private pure returns (INativeQueryVerifier.ContinuityProof memory proof) {
        proof.lowerEndpointDigest = keccak256("lower");
        proof.roots = new bytes32[](0);
    }

    function _marketConfig(bool enabled) private view returns (MarketConfig memory) {
        return MarketConfig({
            sourceChainKey: 1,
            foreignToken: FOREIGN_TOKEN,
            foreignTokenDecimals: 18,
            settlementToken: address(token),
            settlementTokenDecimals: 18,
            enabled: enabled
        });
    }
}
