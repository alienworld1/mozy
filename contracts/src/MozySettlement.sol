// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol";
import {INativeQueryVerifier} from "@gluwa/usc-contracts/contracts/write-ability/INativeQueryVerifier.sol";
import {IAttestcoinVerifier} from "./AttestcoinInterfaces.sol";
import {MozyMarket} from "./MozyMarket.sol";
import {MarketConfig, Reservation, ReservationStatus} from "./ProtocolTypes.sol";
import {
    ZeroAddress,
    IncompatibleReservationState,
    SourceChainMismatch,
    ReceiptAlreadyConsumed,
    AttestcoinVerificationFailed,
    SourceReceiptUnsuccessful,
    TransactionTargetMismatch,
    TransferCallMismatch,
    WrongDeliverySender,
    WrongDeliveryRecipient,
    WrongDeliveryToken,
    AmbiguousTransfer,
    Underdelivery,
    InvalidDeliveryTiming,
    Unauthorized
} from "./ProtocolErrors.sol";

contract MozySettlement is ReentrancyGuard {
    bytes32 public constant TRANSFER_TOPIC = keccak256("Transfer(address,address,uint256)");
    bytes4 public constant TRANSFER_SELECTOR = bytes4(keccak256("transfer(address,uint256)"));

    MozyMarket public immutable market;
    IAttestcoinVerifier public immutable verifier;

    mapping(bytes32 replayIdentity => uint256 reservationId) private _receiptReservations;

    event ReservationSettled(
        uint256 indexed reservationId,
        uint256 indexed mandateId,
        bytes32 indexed replayIdentity,
        uint64 sourceChainKey,
        uint64 blockHeight,
        uint64 transactionIndex,
        uint64 transferLogIndex,
        address token,
        address solver,
        address recipient,
        address relayer,
        uint256 deliveredAmount,
        uint256 creditedAmount,
        uint256 lockedPayout,
        uint256 returnedBond
    );

    constructor(MozyMarket protocolMarket, IAttestcoinVerifier attestcoinVerifier) {
        if (address(protocolMarket) == address(0) || address(attestcoinVerifier) == address(0)) revert ZeroAddress();
        market = protocolMarket;
        verifier = attestcoinVerifier;
    }

    function settle(
        uint256 reservationId,
        uint64 chainKey,
        uint64 blockHeight,
        bytes calldata encodedTransaction,
        INativeQueryVerifier.MerkleProof calldata merkleProof,
        INativeQueryVerifier.ContinuityProof calldata continuityProof
    ) external nonReentrant returns (bytes32 replayIdentity) {
        Reservation memory reservation = market.getReservation(reservationId);
        if (reservation.status != ReservationStatus.Active) revert IncompatibleReservationState();
        (MarketConfig memory requirements, address recipient,) = market.getReservationRequirements(reservationId);
        if (chainKey != requirements.sourceChainKey) revert SourceChainMismatch();

        uint64 transactionIndex;
        try verifier.calculateTxIndex(merkleProof) returns (uint64 index) {
            transactionIndex = index;
        } catch {
            revert AttestcoinVerificationFailed();
        }
        replayIdentity = keccak256(abi.encodePacked(uint256(chainKey), blockHeight, uint256(transactionIndex)));
        if (_receiptReservations[replayIdentity] != 0) revert ReceiptAlreadyConsumed();

        try verifier.verify(chainKey, blockHeight, encodedTransaction, merkleProof, continuityProof) returns (
            bool verified
        ) {
            if (!verified) revert AttestcoinVerificationFailed();
        } catch {
            revert AttestcoinVerificationFailed();
        }

        EvmV1Decoder.CommonTxFields memory transaction;
        EvmV1Decoder.ReceiptFields memory receipt;
        try this.decodeAuthenticatedPayload(encodedTransaction) returns (
            EvmV1Decoder.CommonTxFields memory decodedTransaction, EvmV1Decoder.ReceiptFields memory decodedReceipt
        ) {
            transaction = decodedTransaction;
            receipt = decodedReceipt;
        } catch {
            revert AttestcoinVerificationFailed();
        }

        if (receipt.receiptStatus != 1) revert SourceReceiptUnsuccessful();
        if (transaction.toIsNull || transaction.to != requirements.foreignToken) {
            revert TransactionTargetMismatch();
        }
        if (transaction.from != reservation.solver) revert WrongDeliverySender();
        (address callRecipient, uint256 callAmount) = _decodeTransferCall(transaction.data);
        if (callRecipient != recipient) revert WrongDeliveryRecipient();
        if (callAmount < reservation.quantity) revert Underdelivery();

        (uint64 logIndex, uint256 deliveredAmount) = _findTransfer(
            receipt.receiptLogs, requirements.foreignToken, reservation.solver, recipient, reservation.quantity
        );
        if (deliveredAmount != callAmount) revert TransferCallMismatch();
        if (blockHeight < reservation.sourceStartHeight || blockHeight > reservation.sourceEndHeight) {
            revert InvalidDeliveryTiming();
        }

        _receiptReservations[replayIdentity] = reservationId;
        market.settleReservation(reservationId);

        emit ReservationSettled(
            reservationId,
            reservation.mandateId,
            replayIdentity,
            chainKey,
            blockHeight,
            transactionIndex,
            logIndex,
            requirements.foreignToken,
            reservation.solver,
            recipient,
            msg.sender,
            deliveredAmount,
            reservation.quantity,
            reservation.lockedPayout,
            reservation.bondAmount
        );
    }

    function receiptReservation(bytes32 replayIdentity) external view returns (uint256) {
        return _receiptReservations[replayIdentity];
    }

    function isReceiptConsumed(bytes32 replayIdentity) external view returns (bool) {
        return _receiptReservations[replayIdentity] != 0;
    }

    function decodeAuthenticatedPayload(bytes calldata encodedTransaction)
        external
        view
        returns (EvmV1Decoder.CommonTxFields memory transaction, EvmV1Decoder.ReceiptFields memory receipt)
    {
        if (msg.sender != address(this)) revert Unauthorized();
        transaction = EvmV1Decoder.decodeCommonTxFields(encodedTransaction);
        receipt = EvmV1Decoder.decodeReceiptFields(encodedTransaction);
    }

    function _decodeTransferCall(bytes memory data) private pure returns (address recipient, uint256 amount) {
        if (data.length != 68 || bytes4(data) != TRANSFER_SELECTOR) revert TransferCallMismatch();
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
    ) private pure returns (uint64 selectedIndex, uint256 selectedAmount) {
        bool tokenSeen;
        bool senderSeen;
        bool recipientSeen;
        bool sufficientAmountSeen;
        uint256 matches;

        for (uint256 i; i < logs.length; i++) {
            EvmV1Decoder.LogEntry memory log = logs[i];
            if (log.topics.length != 3 || log.topics[0] != TRANSFER_TOPIC) continue;
            if (log.address_ != expectedToken) continue;
            tokenSeen = true;
            if (address(uint160(uint256(log.topics[1]))) != expectedSender) continue;
            senderSeen = true;
            if (address(uint160(uint256(log.topics[2]))) != expectedRecipient) continue;
            recipientSeen = true;
            if (log.data.length != 32) continue;
            uint256 amount = abi.decode(log.data, (uint256));
            if (amount < minimumAmount) continue;
            sufficientAmountSeen = true;
            matches++;
            selectedIndex = uint64(i);
            selectedAmount = amount;
        }

        if (!tokenSeen) revert WrongDeliveryToken();
        if (!senderSeen) revert WrongDeliverySender();
        if (!recipientSeen) revert WrongDeliveryRecipient();
        if (!sufficientAmountSeen) revert Underdelivery();
        if (matches != 1) revert AmbiguousTransfer();
    }
}
