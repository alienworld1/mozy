// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IAttestcoinVerifier} from "../../src/AttestcoinInterfaces.sol";
import {INativeQueryVerifier} from "@gluwa/usc-contracts/contracts/write-ability/INativeQueryVerifier.sol";

contract MockAttestcoinVerifier is IAttestcoinVerifier {
    bool public verificationResult = true;
    bool public shouldRevert;
    uint64 public transactionIndex = 7;

    function configure(bool result, bool reverts, uint64 index) external {
        verificationResult = result;
        shouldRevert = reverts;
        transactionIndex = index;
    }

    function calculateTxIndex(INativeQueryVerifier.MerkleProof calldata) external view returns (uint64) {
        if (shouldRevert) revert();
        return transactionIndex;
    }

    function verify(
        uint64,
        uint64,
        bytes calldata,
        INativeQueryVerifier.MerkleProof calldata,
        INativeQueryVerifier.ContinuityProof calldata
    ) external view returns (bool) {
        if (shouldRevert) revert();
        return verificationResult;
    }
}
