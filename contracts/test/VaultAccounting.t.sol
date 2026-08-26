// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {TestBase} from "./TestBase.sol";
import {SettlementVault} from "../src/SettlementVault.sol";
import {VaultAccount} from "../src/ProtocolTypes.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract VaultOperatorHarness {
    SettlementVault public immutable vault;

    constructor() {
        vault = new SettlementVault(address(this));
    }

    function deposit(uint256 id, address token, address payer, uint256 amount) external {
        vault.deposit(id, token, payer, amount);
    }

    function lock(uint256 id, address token, uint256 amount) external {
        vault.lock(id, token, amount);
    }

    function unlock(uint256 id, address token, uint256 amount) external {
        vault.unlock(id, token, amount);
    }

    function spend(uint256 id, address token, address recipient, uint256 amount) external {
        vault.spend(id, token, recipient, amount);
    }
}

contract VaultAccountingTest is TestBase {
    address private constant BUYER = address(0xB0B);
    address private constant SOLVER = address(0x5017E2);

    function testFutureOnlyBucketSeamPreservesCustodyAndHistory() external {
        MockERC20 token = new MockERC20();
        VaultOperatorHarness operator = new VaultOperatorHarness();
        SettlementVault vault = operator.vault();
        token.mint(BUYER, 100);
        vm.prank(BUYER);
        token.approve(address(vault), 100);

        operator.deposit(1, address(token), BUYER, 100);
        operator.lock(1, address(token), 70);
        operator.unlock(1, address(token), 20);
        operator.spend(1, address(token), SOLVER, 30);

        VaultAccount memory account = vault.getAccount(1);
        assertEq(account.funded, 100);
        assertEq(account.spent, 30);
        assertEq(account.reserved, 20);
        assertEq(account.free, 50);
        assertEq(token.balanceOf(SOLVER), 30);
        assertEq(token.balanceOf(address(vault)), 70);
        assertEq(vault.accountedTokenBalance(address(token)), 70);
        assertTrue(vault.isSolvent(address(token)));
    }

    function testFuzzBucketIdentity(uint96 rawFunded, uint96 rawLocked, uint96 rawSpent) external {
        uint256 funded = uint256(rawFunded) % 1e24 + 1;
        uint256 locked = uint256(rawLocked) % funded + 1;
        uint256 spent = uint256(rawSpent) % locked + 1;
        MockERC20 token = new MockERC20();
        VaultOperatorHarness operator = new VaultOperatorHarness();
        SettlementVault vault = operator.vault();
        token.mint(BUYER, funded);
        vm.prank(BUYER);
        token.approve(address(vault), funded);
        operator.deposit(7, address(token), BUYER, funded);
        operator.lock(7, address(token), locked);
        operator.spend(7, address(token), SOLVER, spent);
        VaultAccount memory account = vault.getAccount(7);
        assertEq(account.funded, account.spent + account.reserved + account.free + account.refunded);
        assertEq(token.balanceOf(address(vault)), account.reserved + account.free);
    }
}
