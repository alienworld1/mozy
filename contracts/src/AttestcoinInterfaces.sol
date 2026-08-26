// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {INativeQueryVerifier} from "@gluwa/usc-contracts/contracts/write-ability/INativeQueryVerifier.sol";

interface IAttestcoinVerifier is INativeQueryVerifier {
    function calculateTxIndex(MerkleProof calldata merkleProof) external view returns (uint64);
}

interface IAttestcoinChainInfo {
    function get_latest_attestation_height_and_hash(uint64 chainKey)
        external
        view
        returns (uint64 height, bytes32 hash, bool isAttestation, bool exists);
}
