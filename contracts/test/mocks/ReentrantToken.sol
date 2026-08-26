// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ReentrantToken is ERC20 {
    address public callbackTarget;
    bytes public callbackData;
    bool private _entered;

    constructor() ERC20("Reentrant Token", "REENTER") {}

    function mint(address recipient, uint256 amount) external {
        _mint(recipient, amount);
    }

    function setCallback(address target, bytes calldata data) external {
        callbackTarget = target;
        callbackData = data;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (!_entered && from != address(0) && callbackTarget != address(0)) {
            _entered = true;
            (bool success,) = callbackTarget.call(callbackData);
            require(!success, "reentry unexpectedly succeeded");
            _entered = false;
        }
        super._update(from, to, value);
    }
}
