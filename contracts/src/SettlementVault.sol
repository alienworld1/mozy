// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {VaultAccount} from "./ProtocolTypes.sol";
import {
    Unauthorized,
    ZeroAddress,
    InvalidFundingAmount,
    InvalidRefundAmount,
    UnexpectedTokenBalanceDelta,
    VaultAccountTokenMismatch,
    RefundExceedsFreeBalance,
    AccountingInvariantViolation
} from "./ProtocolErrors.sol";

/// @notice Holds settlement tokens and owns all mandate-level budget accounting.
contract SettlementVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable marketOperator;
    mapping(uint256 mandateId => VaultAccount) private _accounts;
    mapping(address token => uint256 held) public accountedTokenBalance;

    modifier onlyMarketOperator() {
        if (msg.sender != marketOperator) revert Unauthorized();
        _;
    }

    constructor(address operator) {
        if (operator == address(0)) revert ZeroAddress();
        marketOperator = operator;
    }

    function deposit(uint256 mandateId, address token, address payer, uint256 amount)
        external
        onlyMarketOperator
        nonReentrant
    {
        if (amount == 0) revert InvalidFundingAmount();
        VaultAccount storage account = _accountFor(mandateId, token);
        IERC20 settlementToken = IERC20(token);
        uint256 balanceBefore = settlementToken.balanceOf(address(this));
        settlementToken.safeTransferFrom(payer, address(this), amount);
        uint256 balanceAfter = settlementToken.balanceOf(address(this));
        if (balanceAfter < balanceBefore || balanceAfter - balanceBefore != amount) {
            revert UnexpectedTokenBalanceDelta();
        }

        account.funded += amount;
        account.free += amount;
        accountedTokenBalance[token] += amount;
        _assertAccount(account);
    }

    function refund(uint256 mandateId, address token, address buyer, uint256 amount)
        external
        onlyMarketOperator
        nonReentrant
    {
        if (amount == 0) revert InvalidRefundAmount();
        VaultAccount storage account = _accountFor(mandateId, token);
        if (amount > account.free) revert RefundExceedsFreeBalance();

        account.free -= amount;
        account.refunded += amount;
        accountedTokenBalance[token] -= amount;
        _assertAccount(account);

        IERC20 settlementToken = IERC20(token);
        uint256 vaultBefore = settlementToken.balanceOf(address(this));
        uint256 buyerBefore = settlementToken.balanceOf(buyer);
        settlementToken.safeTransfer(buyer, amount);
        uint256 vaultAfter = settlementToken.balanceOf(address(this));
        uint256 buyerAfter = settlementToken.balanceOf(buyer);
        if (
            vaultBefore < vaultAfter || vaultBefore - vaultAfter != amount || buyerAfter < buyerBefore
                || buyerAfter - buyerBefore != amount
        ) {
            revert UnexpectedTokenBalanceDelta();
        }
    }

    // These market-only bucket primitives are the narrow accounting seam used by Modules 3 and 4.
    function lock(uint256 mandateId, address token, uint256 amount) external onlyMarketOperator {
        VaultAccount storage account = _accountFor(mandateId, token);
        if (amount == 0 || amount > account.free) revert AccountingInvariantViolation();
        account.free -= amount;
        account.reserved += amount;
        _assertAccount(account);
    }

    function unlock(uint256 mandateId, address token, uint256 amount) external onlyMarketOperator {
        VaultAccount storage account = _accountFor(mandateId, token);
        if (amount == 0 || amount > account.reserved) revert AccountingInvariantViolation();
        account.reserved -= amount;
        account.free += amount;
        _assertAccount(account);
    }

    function spend(uint256 mandateId, address token, address recipient, uint256 amount)
        external
        onlyMarketOperator
        nonReentrant
    {
        if (recipient == address(0)) revert ZeroAddress();
        VaultAccount storage account = _accountFor(mandateId, token);
        if (amount == 0 || amount > account.reserved) revert AccountingInvariantViolation();
        account.reserved -= amount;
        account.spent += amount;
        accountedTokenBalance[token] -= amount;
        _assertAccount(account);

        IERC20 settlementToken = IERC20(token);
        uint256 vaultBefore = settlementToken.balanceOf(address(this));
        uint256 recipientBefore = settlementToken.balanceOf(recipient);
        settlementToken.safeTransfer(recipient, amount);
        uint256 vaultAfter = settlementToken.balanceOf(address(this));
        uint256 recipientAfter = settlementToken.balanceOf(recipient);
        if (
            vaultBefore < vaultAfter || vaultBefore - vaultAfter != amount || recipientAfter < recipientBefore
                || recipientAfter - recipientBefore != amount
        ) {
            revert UnexpectedTokenBalanceDelta();
        }
    }

    function getAccount(uint256 mandateId) external view returns (VaultAccount memory) {
        return _accounts[mandateId];
    }

    function isSolvent(address token) external view returns (bool) {
        return IERC20(token).balanceOf(address(this)) >= accountedTokenBalance[token];
    }

    function _accountFor(uint256 mandateId, address token) private returns (VaultAccount storage account) {
        account = _accounts[mandateId];
        if (account.token == address(0)) account.token = token;
        else if (account.token != token) revert VaultAccountTokenMismatch();
    }

    function _assertAccount(VaultAccount storage account) private view {
        if (account.funded != account.spent + account.reserved + account.free + account.refunded) {
            revert AccountingInvariantViolation();
        }
    }
}
