// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol";
import {INativeQueryVerifier} from "@gluwa/usc-contracts/contracts/write-ability/INativeQueryVerifier.sol";

interface IBlockProver {
    function verifyAndEmit(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        INativeQueryVerifier.MerkleProof calldata merkleProof,
        INativeQueryVerifier.ContinuityProof calldata continuityProof
    ) external returns (bool);

    function calculateTxIndex(INativeQueryVerifier.MerkleProof calldata merkleProof) external view returns (uint64);
}

/// @notice Receipt Proof testnet spike. It authenticates receipt semantics and has no economic state.
contract ReceiptSemanticProbe {
    address public constant BLOCK_PROVER = 0x0000000000000000000000000000000000000FD2;
    bytes32 public constant TRANSFER_TOPIC = keccak256("Transfer(address,address,uint256)");

    error CryptographicVerificationFailed();
    error SourceChainMismatch(uint64 actual, uint64 expected);
    error UnsuccessfulReceipt();
    error TransactionTargetMismatch(address actual, address expected);
    error TransactionSenderMismatch(address actual, address expected);
    error TransferCallMismatch();
    error TransferSenderMismatch();
    error TransferRecipientMismatch();
    error TransferAmountBelowMinimum();
    error AmbiguousTransfer(uint256 matchingLogs);

    event ReceiptSemanticsAuthenticated(
        uint64 indexed sourceChainKey,
        uint64 indexed blockHeight,
        uint64 transactionIndex,
        bytes32 indexed replayIdentity,
        address token,
        address sender,
        address recipient,
        uint256 amount,
        uint64 transferLogIndex
    );

    function verifyReceipt(
        uint64 chainKey,
        uint64 blockHeight,
        bytes calldata encodedTransaction,
        INativeQueryVerifier.MerkleProof calldata merkleProof,
        INativeQueryVerifier.ContinuityProof calldata continuityProof,
        uint64 expectedChainKey,
        address expectedToken,
        address expectedSender,
        address expectedRecipient,
        uint256 minimumAmount
    ) external returns (bytes32 replayIdentity) {
        if (chainKey != expectedChainKey) revert SourceChainMismatch(chainKey, expectedChainKey);

        try IBlockProver(BLOCK_PROVER).verifyAndEmit(
            chainKey, blockHeight, encodedTransaction, merkleProof, continuityProof
        ) returns (bool verified) {
            if (!verified) revert CryptographicVerificationFailed();
        } catch {
            revert CryptographicVerificationFailed();
        }

        EvmV1Decoder.CommonTxFields memory transaction = EvmV1Decoder.decodeCommonTxFields(encodedTransaction);
        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTransaction);

        if (receipt.receiptStatus != 1) revert UnsuccessfulReceipt();
        if (transaction.toIsNull || transaction.to != expectedToken) {
            revert TransactionTargetMismatch(transaction.to, expectedToken);
        }
        if (transaction.from != expectedSender) revert TransactionSenderMismatch(transaction.from, expectedSender);
        (address callRecipient, uint256 callAmount) = _decodeTransferCall(transaction.data);
        if (callRecipient != expectedRecipient || callAmount < minimumAmount) revert TransferCallMismatch();

        (uint256 matchingLogs, uint64 logIndex, uint256 amount) = _findTransfer(
            receipt.receiptLogs, expectedToken, expectedSender, expectedRecipient, minimumAmount
        );
        if (matchingLogs != 1) revert AmbiguousTransfer(matchingLogs);
        if (amount != callAmount) revert TransferCallMismatch();

        uint64 transactionIndex = IBlockProver(BLOCK_PROVER).calculateTxIndex(merkleProof);
        replayIdentity = keccak256(abi.encodePacked(uint256(chainKey), blockHeight, uint256(transactionIndex)));

        emit ReceiptSemanticsAuthenticated(
            chainKey,
            blockHeight,
            transactionIndex,
            replayIdentity,
            expectedToken,
            expectedSender,
            expectedRecipient,
            amount,
            logIndex
        );
    }

    function _decodeTransferCall(bytes memory data) private pure returns (address recipient, uint256 amount) {
        if (data.length != 68 || bytes4(data) != bytes4(keccak256("transfer(address,uint256)"))) {
            revert TransferCallMismatch();
        }
        assembly {
            recipient := mload(add(data, 36))
            amount := mload(add(data, 68))
        }
    }

    function _findTransfer(
        EvmV1Decoder.LogEntry[] memory logs,
        address expectedToken,
        address expectedSender,
        address expectedRecipient,
        uint256 minimumAmount
    ) private pure returns (uint256 matches, uint64 selectedIndex, uint256 selectedAmount) {
        bool senderSeen;
        bool recipientSeen;
        bool sufficientAmountSeen;

        for (uint256 i; i < logs.length; i++) {
            EvmV1Decoder.LogEntry memory log = logs[i];
            if (log.address_ != expectedToken || log.topics.length != 3 || log.topics[0] != TRANSFER_TOPIC) {
                continue;
            }

            address sender = address(uint160(uint256(log.topics[1])));
            address recipient = address(uint160(uint256(log.topics[2])));
            if (sender != expectedSender) continue;
            senderSeen = true;
            if (recipient != expectedRecipient) continue;
            recipientSeen = true;
            if (log.data.length != 32) continue;

            uint256 amount = abi.decode(log.data, (uint256));
            if (amount < minimumAmount) continue;
            sufficientAmountSeen = true;
            matches++;
            selectedIndex = uint64(i);
            selectedAmount = amount;
        }

        if (!senderSeen) revert TransferSenderMismatch();
        if (!recipientSeen) revert TransferRecipientMismatch();
        if (!sufficientAmountSeen) revert TransferAmountBelowMinimum();
    }
}
