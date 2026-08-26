// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IAttestcoinChainInfo} from "../../src/AttestcoinInterfaces.sol";

contract ClockedChainInfo is IAttestcoinChainInfo {
    function get_latest_attestation_height_and_hash(uint64)
        external
        view
        returns (uint64 height, bytes32 hash, bool isAttestation, bool exists)
    {
        height = uint64(block.timestamp);
        hash = keccak256(abi.encode(height));
        isAttestation = true;
        exists = true;
    }
}
