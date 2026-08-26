// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ShortTransferToken is ERC20 {
    constructor() ERC20("Short Transfer", "SHORT") {}

    function mint(address recipient, uint256 amount) external {
        _mint(recipient, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && value > 1) super._update(from, to, value - 1);
        else super._update(from, to, value);
    }
}
