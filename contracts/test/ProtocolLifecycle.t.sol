// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {TestBase} from "./TestBase.sol";
import {MarketRegistry} from "../src/MarketRegistry.sol";
import {MozyMarket} from "../src/MozyMarket.sol";
import {SettlementVault} from "../src/SettlementVault.sol";
import {PricingMode, MandateStatus, MarketConfig, Mandate, VaultAccount} from "../src/ProtocolTypes.sol";
import {
    ProtocolNotConfigured,
    MarketNotEnabled,
    MarketAlreadyConfigured,
    ProtocolPaused,
    NotMandateBuyer,
    FundingExceedsRequirement,
    InvalidMandateStatus,
    RefundExceedsFreeBalance,
    OutstandingMandateBalance,
    UnexpectedTokenBalanceDelta
} from "../src/ProtocolErrors.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {ShortTransferToken} from "./mocks/ShortTransferToken.sol";
import {ReentrantToken} from "./mocks/ReentrantToken.sol";
import {FalseReturnToken} from "./mocks/FalseReturnToken.sol";
import {ClockedChainInfo} from "./mocks/ClockedChainInfo.sol";

contract ProtocolLifecycleTest is TestBase {
    address private constant ADMIN = address(0xA11CE);
    address private constant BUYER = address(0xB0B);
    address private constant OTHER = address(0xCAFE);
    address private constant FOREIGN_TOKEN = address(0x1234);
    uint256 private constant UNIT = 1e18;

    MockERC20 private token;
    MarketRegistry private registry;
    MozyMarket private market;
    SettlementVault private vault;

    function setUp() external {
        token = new MockERC20();
        (registry, market, vault) = _deploy(address(token));
        token.mint(BUYER, 1_000 * UNIT);
        vm.prank(BUYER);
        token.approve(address(vault), type(uint256).max);
    }

    function testRequiresOneTimeWiringAndOneMarket() external {
        MarketRegistry unwiredRegistry =
            new MarketRegistry(ADMIN, 1, FOREIGN_TOKEN, 18, address(token), 18, keccak256("test"));
        vm.prank(ADMIN);
        unwiredRegistry.configureReleaseMarket(_config(address(token), true));
        MozyMarket unwired = new MozyMarket(ADMIN, unwiredRegistry, new ClockedChainInfo(), 10, 5, 100, 10 * UNIT);
        vm.prank(BUYER);
        vm.expectRevert(ProtocolNotConfigured.selector);
        unwired.createMandate(1, BUYER, UNIT, PricingMode.Limit, UNIT, UNIT, uint64(block.timestamp + 1 days), 1 hours);

        vm.prank(ADMIN);
        vm.expectRevert(MarketAlreadyConfigured.selector);
        registry.configureReleaseMarket(_config(address(token), true));
    }

    function testHappyPathFundingLifecycleAndIsolation() external {
        uint256 first = _create(PricingMode.Range, 2 * UNIT, 2 * UNIT, 4 * UNIT);
        Mandate memory created = market.getMandate(first);
        assertEq(uint256(created.status), uint256(MandateStatus.Funding));
        assertEq(created.requiredFunding, 6 * UNIT);

        _fund(first, 2 * UNIT);
        assertEq(uint256(market.getMandate(first).status), uint256(MandateStatus.Funding));
        _fund(first, 4 * UNIT);
        assertEq(uint256(market.getMandate(first).status), uint256(MandateStatus.Open));

        vm.prank(BUYER);
        market.pauseMandate(first);
        vm.prank(BUYER);
        market.resumeMandate(first);
        vm.prank(BUYER);
        market.cancelMandate(first);

        vm.prank(BUYER);
        market.refundMandate(first, UNIT);
        vm.prank(BUYER);
        market.refundMandate(first, 5 * UNIT);
        market.closeMandate(first);

        Mandate memory closed = market.getMandate(first);
        VaultAccount memory account = vault.getAccount(first);
        assertEq(uint256(closed.status), uint256(MandateStatus.Closed));
        assertEq(account.funded, 6 * UNIT);
        assertEq(account.refunded, 6 * UNIT);
        assertEq(account.free, 0);

        uint256 second = _create(PricingMode.Limit, UNIT, UNIT, UNIT);
        assertEq(second, first + 1);
        assertEq(vault.getAccount(second).funded, 0);
    }

    function testPreviewMatchesCreatedFundingForEveryPricingDirection() external {
        _assertPreviewMatchesCreation(PricingMode.Limit, 2 * UNIT, 3 * UNIT, 3 * UNIT);
        _assertPreviewMatchesCreation(PricingMode.Range, 2 * UNIT, 2 * UNIT, 4 * UNIT);
        _assertPreviewMatchesCreation(PricingMode.Range, 2 * UNIT, 4 * UNIT, 2 * UNIT);
        _assertPreviewMatchesCreation(PricingMode.Range, 2 * UNIT, 3 * UNIT, 3 * UNIT);
    }

    function _assertPreviewMatchesCreation(PricingMode mode, uint256 target, uint256 start, uint256 end)
        private
    {
        uint64 expiry = uint64(block.timestamp + 1 days);
        uint256 preview = market.previewMandateFunding(1, BUYER, target, mode, start, end, expiry, 1 hours);
        vm.prank(BUYER);
        uint256 id = market.createMandate(1, BUYER, target, mode, start, end, expiry, 1 hours);
        assertEq(market.getMandate(id).requiredFunding, preview);
    }

    function testUnauthorizedAndInvalidTransitionsDoNotMutateAccounting() external {
        uint256 id = _create(PricingMode.Limit, UNIT, 2 * UNIT, 2 * UNIT);
        vm.prank(OTHER);
        vm.expectRevert(NotMandateBuyer.selector);
        market.fundMandate(id, UNIT);
        assertEq(vault.getAccount(id).funded, 0);

        _fund(id, 2 * UNIT);
        vm.prank(BUYER);
        vm.expectRevert(InvalidMandateStatus.selector);
        market.fundMandate(id, 1);
        vm.prank(OTHER);
        vm.expectRevert(NotMandateBuyer.selector);
        market.pauseMandate(id);

        vm.prank(BUYER);
        market.cancelMandate(id);
        vm.prank(BUYER);
        vm.expectRevert(RefundExceedsFreeBalance.selector);
        market.refundMandate(id, 2 * UNIT + 1);
        vm.expectRevert(OutstandingMandateBalance.selector);
        market.closeMandate(id);
        assertEq(vault.getAccount(id).free, 2 * UNIT);
    }

    function testOverfundAndMarketDisablementPreserveSafeExit() external {
        uint256 id = _create(PricingMode.Limit, UNIT, 2 * UNIT, 2 * UNIT);
        vm.prank(BUYER);
        vm.expectRevert(FundingExceedsRequirement.selector);
        market.fundMandate(id, 2 * UNIT + 1);
        assertEq(vault.getAccount(id).funded, 0);

        _fund(id, 2 * UNIT);
        vm.prank(BUYER);
        market.pauseMandate(id);
        vm.prank(ADMIN);
        registry.setMarketEnabled(1, false);
        vm.prank(BUYER);
        vm.expectRevert(MarketNotEnabled.selector);
        market.resumeMandate(id);
        vm.prank(BUYER);
        market.cancelMandate(id);
        vm.prank(BUYER);
        market.refundMandate(id, 2 * UNIT);
        market.closeMandate(id);
    }

    function testProtocolPauseBlocksRiskButNotCancellationOrRefund() external {
        uint256 id = _create(PricingMode.Limit, UNIT, 2 * UNIT, 2 * UNIT);
        _fund(id, UNIT);
        vm.prank(ADMIN);
        market.setProtocolPaused(true);
        vm.prank(BUYER);
        vm.expectRevert(ProtocolPaused.selector);
        market.fundMandate(id, UNIT);
        vm.prank(BUYER);
        market.cancelMandate(id);
        vm.prank(BUYER);
        market.refundMandate(id, UNIT);
        market.closeMandate(id);
    }

    function testExpiryMakesFreeCapitalRefundable() external {
        uint256 id = _create(PricingMode.Limit, UNIT, 2 * UNIT, 2 * UNIT);
        _fund(id, UNIT);
        Mandate memory mandate = market.getMandate(id);
        vm.warp(mandate.mandateExpiry);
        vm.prank(OTHER);
        market.expireMandate(id);
        vm.prank(BUYER);
        market.refundMandate(id, UNIT);
        vm.prank(OTHER);
        market.closeMandate(id);
        assertEq(uint256(market.getMandate(id).status), uint256(MandateStatus.Closed));
    }

    function testDirectTransferDoesNotCreditMandate() external {
        uint256 id = _create(PricingMode.Limit, UNIT, UNIT, UNIT);
        vm.prank(BUYER);
        assertTrue(token.transfer(address(vault), UNIT));
        assertEq(vault.getAccount(id).funded, 0);
        assertEq(vault.accountedTokenBalance(address(token)), 0);
        assertTrue(vault.isSolvent(address(token)));
    }

    function testAdminCannotMutateVaultBucketsDirectly() external {
        uint256 id = _create(PricingMode.Limit, UNIT, UNIT, UNIT);
        vm.prank(ADMIN);
        vm.expectRevert();
        vault.lock(id, address(token), 1);
    }

    function testShortTransferRevertsWithoutCredit() external {
        ShortTransferToken shortToken = new ShortTransferToken();
        (, MozyMarket shortMarket, SettlementVault shortVault) = _deploy(address(shortToken));
        shortToken.mint(BUYER, 10 * UNIT);
        vm.prank(BUYER);
        shortToken.approve(address(shortVault), type(uint256).max);
        uint256 id = _createOn(shortMarket, PricingMode.Limit, UNIT, 2 * UNIT, 2 * UNIT);
        vm.prank(BUYER);
        vm.expectRevert(UnexpectedTokenBalanceDelta.selector);
        shortMarket.fundMandate(id, 2 * UNIT);
        assertEq(shortVault.getAccount(id).funded, 0);
        assertEq(shortToken.balanceOf(address(shortVault)), 0);
    }

    function testFalseReturnTokenRevertsWithoutCredit() external {
        FalseReturnToken falseToken = new FalseReturnToken();
        (, MozyMarket falseMarket, SettlementVault falseVault) = _deploy(address(falseToken));
        vm.prank(BUYER);
        falseToken.approve(address(falseVault), type(uint256).max);
        uint256 id = _createOn(falseMarket, PricingMode.Limit, UNIT, 2 * UNIT, 2 * UNIT);
        vm.prank(BUYER);
        vm.expectRevert();
        falseMarket.fundMandate(id, 2 * UNIT);
        assertEq(falseVault.getAccount(id).funded, 0);
    }

    function testReentrantFundingCallbackCannotDoubleCredit() external {
        ReentrantToken reentrant = new ReentrantToken();
        (, MozyMarket reentrantMarket, SettlementVault reentrantVault) = _deploy(address(reentrant));
        reentrant.mint(BUYER, 10 * UNIT);
        vm.prank(BUYER);
        reentrant.approve(address(reentrantVault), type(uint256).max);
        uint256 id = _createOn(reentrantMarket, PricingMode.Limit, UNIT, 2 * UNIT, 2 * UNIT);
        reentrant.setCallback(address(reentrantMarket), abi.encodeCall(reentrantMarket.fundMandate, (id, 1)));
        vm.prank(BUYER);
        reentrantMarket.fundMandate(id, 2 * UNIT);
        assertEq(reentrantVault.getAccount(id).funded, 2 * UNIT);
    }

    function testReentrantRefundCallbackCannotDoubleRefund() external {
        ReentrantToken reentrant = new ReentrantToken();
        (, MozyMarket reentrantMarket, SettlementVault reentrantVault) = _deploy(address(reentrant));
        reentrant.mint(BUYER, 10 * UNIT);
        vm.prank(BUYER);
        reentrant.approve(address(reentrantVault), type(uint256).max);
        uint256 id = _createOn(reentrantMarket, PricingMode.Limit, UNIT, 2 * UNIT, 2 * UNIT);
        vm.prank(BUYER);
        reentrantMarket.fundMandate(id, 2 * UNIT);
        vm.prank(BUYER);
        reentrantMarket.cancelMandate(id);
        reentrant.setCallback(address(reentrantMarket), abi.encodeCall(reentrantMarket.refundMandate, (id, UNIT)));
        vm.prank(BUYER);
        reentrantMarket.refundMandate(id, 2 * UNIT);
        VaultAccount memory account = reentrantVault.getAccount(id);
        assertEq(account.refunded, 2 * UNIT);
        assertEq(account.free, 0);
    }

    function testFuzzPartialFundingReconciles(uint96 rawFirst) external {
        uint256 id = _create(PricingMode.Limit, UNIT, 100 * UNIT, 100 * UNIT);
        uint256 first = uint256(rawFirst) % (100 * UNIT - 1) + 1;
        _fund(id, first);
        VaultAccount memory partialAccount = vault.getAccount(id);
        assertEq(partialAccount.funded, partialAccount.free);
        _fund(id, 100 * UNIT - first);
        (, VaultAccount memory finalAccount, bool quantityOk, bool budgetOk) = market.auditMandate(id);
        assertTrue(quantityOk);
        assertTrue(budgetOk);
        assertEq(finalAccount.funded, 100 * UNIT);
    }

    function testFuzzMandateIsolationAndCancellation(uint96 rawFirst, uint96 rawSecond, uint96 rawRefund) external {
        uint256 first = _create(PricingMode.Limit, UNIT, 100 * UNIT, 100 * UNIT);
        uint256 second = _create(PricingMode.Limit, UNIT, 100 * UNIT, 100 * UNIT);
        uint256 firstFunding = uint256(rawFirst) % (100 * UNIT) + 1;
        uint256 secondFunding = uint256(rawSecond) % (100 * UNIT) + 1;
        _fund(first, firstFunding);
        _fund(second, secondFunding);
        vm.prank(BUYER);
        market.cancelMandate(first);
        uint256 refund = uint256(rawRefund) % firstFunding + 1;
        vm.prank(BUYER);
        market.refundMandate(first, refund);
        VaultAccount memory firstAccount = vault.getAccount(first);
        VaultAccount memory secondAccount = vault.getAccount(second);
        assertEq(firstAccount.funded, firstFunding);
        assertEq(firstAccount.refunded, refund);
        assertEq(secondAccount.funded, secondFunding);
        assertEq(token.balanceOf(address(vault)), firstFunding - refund + secondFunding);
    }

    function testFuzzUnauthorizedCallerCannotCancel(address caller) external {
        vm.assume(caller != BUYER);
        uint256 id = _create(PricingMode.Limit, UNIT, UNIT, UNIT);
        vm.prank(caller);
        vm.expectRevert(NotMandateBuyer.selector);
        market.cancelMandate(id);
        assertEq(uint256(market.getMandate(id).status), uint256(MandateStatus.Funding));
    }

    function _deploy(address settlementToken)
        private
        returns (MarketRegistry deployedRegistry, MozyMarket deployedMarket, SettlementVault deployedVault)
    {
        deployedRegistry = new MarketRegistry(ADMIN, 1, FOREIGN_TOKEN, 18, settlementToken, 18, keccak256("test"));
        deployedMarket = new MozyMarket(ADMIN, deployedRegistry, new ClockedChainInfo(), 10, 5, 100, 10 * UNIT);
        deployedVault = new SettlementVault(address(deployedMarket));
        vm.startPrank(ADMIN);
        deployedMarket.configureVault(deployedVault);
        deployedRegistry.configureReleaseMarket(_config(settlementToken, true));
        vm.stopPrank();
    }

    function _config(address settlementToken, bool enabled) private pure returns (MarketConfig memory) {
        return MarketConfig({
            sourceChainKey: 1,
            foreignToken: FOREIGN_TOKEN,
            foreignTokenDecimals: 18,
            settlementToken: settlementToken,
            settlementTokenDecimals: 18,
            enabled: enabled
        });
    }

    function _create(PricingMode mode, uint256 target, uint256 startPrice, uint256 endPrice)
        private
        returns (uint256)
    {
        return _createOn(market, mode, target, startPrice, endPrice);
    }

    function _createOn(MozyMarket targetMarket, PricingMode mode, uint256 target, uint256 startPrice, uint256 endPrice)
        private
        returns (uint256)
    {
        vm.prank(BUYER);
        return targetMarket.createMandate(
            1, BUYER, target, mode, startPrice, endPrice, uint64(block.timestamp + 1 days), 1 hours
        );
    }

    function _fund(uint256 id, uint256 amount) private {
        vm.prank(BUYER);
        market.fundMandate(id, amount);
    }
}
