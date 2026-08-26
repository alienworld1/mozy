// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IAttestcoinChainInfo} from "../../src/AttestcoinInterfaces.sol";

contract MockChainInfo is IAttestcoinChainInfo {
    uint64 public latestHeight;
    bool public available = true;

    constructor(uint64 initialHeight) {
        latestHeight = initialHeight;
    }

    function setLatestHeight(uint64 height) external {
        latestHeight = height;
    }

    function setAvailable(bool value) external {
        available = value;
    }

    function get_latest_attestation_height_and_hash(uint64)
        external
        view
        returns (uint64 height, bytes32 hash, bool isAttestation, bool exists)
    {
        height = latestHeight;
        hash = keccak256(abi.encode(height));
        isAttestation = true;
        exists = available;
    }
}
