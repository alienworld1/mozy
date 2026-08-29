import { Contract, Interface, JsonRpcProvider, getAddress } from "ethers";
import { attestcoinEnvironment as config } from "../../config/attestcoin-environment.js";
import { ERC20_ABI, TRANSFER_TOPIC } from "./constants.js";
import { AttestcoinError } from "./errors.js";
import { deriveReplayIdentity } from "./replay-identity.js";
import type { ReceiptEvidence, TransferExpectation } from "./types.js";

const transferInterface = new Interface(ERC20_ABI);

interface MatchingTransfer {
  index: number;
  emitter: string;
  from: string;
  to: string;
  amount: bigint;
}

export async function inspectReceipt(
  provider: JsonRpcProvider,
  hash: `0x${string}`,
  expectation: TransferExpectation,
  authenticated: boolean,
): Promise<ReceiptEvidence> {
  const [transaction, receipt] = await Promise.all([
    provider.getTransaction(hash),
    provider.getTransactionReceipt(hash),
  ]);
  if (!transaction || !receipt) {
    throw new AttestcoinError(
      "Waiting for source receipt",
      "receipt_error",
      "The source transaction is pending, dropped, or not visible through the configured RPC.",
      "Keep the same transaction hash and retry inspection. Do not resend the transfer automatically.",
      2,
    );
  }
  if (receipt.status !== 1) {
    throw new AttestcoinError(
      "Inspecting source receipt",
      "receipt_error",
      "The source transaction was included but did not succeed.",
      "Do not prove this receipt. Diagnose the source transaction and explicitly send a new transfer if needed.",
    );
  }
  if (
    !transaction.to ||
    getAddress(transaction.to) !== getAddress(expectation.token)
  ) {
    throw semanticError(
      "Delivery did not call the approved token contract directly.",
      "Use the selected ERC-20 transfer function directly; do not use a router or adapter.",
    );
  }
  if (getAddress(transaction.from) !== getAddress(expectation.sender)) {
    throw semanticError(
      "Source transaction sender does not match the expected solver address.",
      "Use the disposable solver identity recorded for this transfer.",
    );
  }
  let transferCall;
  try {
    transferCall = transferInterface.parseTransaction({
      data: transaction.data,
      value: transaction.value,
    });
  } catch {
    transferCall = null;
  }
  if (transferCall?.name !== "transfer") {
    throw semanticError(
      "Delivery did not call the approved token transfer function directly.",
      "Call transfer(recipient, amount) on the selected ERC-20 without a router, adapter, or alternate token function.",
    );
  }
  if (
    getAddress(transferCall.args[0] as string) !==
    getAddress(expectation.recipient)
  ) {
    throw semanticError(
      "Transfer recipient does not match the expected delivery wallet.",
      "Use the exact buyer delivery address shown for this reservation.",
    );
  }
  if ((transferCall.args[1] as bigint) < BigInt(expectation.minimumAmount)) {
    throw semanticError(
      "Transferred amount is below the required delivery amount.",
      "Transfer at least the reserved amount in one ordinary ERC-20 transfer.",
    );
  }

  const canonicalLogs: MatchingTransfer[] = [];
  for (const log of receipt.logs) {
    if (
      getAddress(log.address) !== getAddress(expectation.token) ||
      log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC
    ) {
      continue;
    }
    try {
      const decoded = transferInterface.decodeEventLog(
        "Transfer",
        log.data,
        log.topics,
      );
      canonicalLogs.push({
        index: log.index,
        emitter: getAddress(log.address),
        from: getAddress(decoded.from as string),
        to: getAddress(decoded.to as string),
        amount: decoded.value as bigint,
      });
    } catch {
      // A log with the signature but malformed canonical fields is not qualifying.
    }
  }

  if (canonicalLogs.length === 0) {
    throw semanticError(
      "No qualifying Transfer log was found for this delivery.",
      "Inspect the token receipt and use a standard ERC-20 transfer with one canonical Transfer log.",
    );
  }

  const senderLogs = canonicalLogs.filter(
    (log) => log.from === getAddress(expectation.sender),
  );
  if (senderLogs.length === 0) {
    throw semanticError(
      "Transfer sender does not match the expected solver address.",
      "Use the same disposable solver identity recorded for this transfer.",
    );
  }
  const recipientLogs = senderLogs.filter(
    (log) => log.to === getAddress(expectation.recipient),
  );
  if (recipientLogs.length === 0) {
    throw semanticError(
      "Transfer recipient does not match the expected delivery wallet.",
      "Use the buyer delivery address recorded with the transfer; do not change the evidence artifact.",
    );
  }
  const amountLogs = recipientLogs.filter(
    (log) => log.amount >= BigInt(expectation.minimumAmount),
  );
  if (amountLogs.length === 0) {
    throw semanticError(
      "Transferred amount is below the required delivery amount.",
      "Use a transfer amount at least equal to the recorded base-unit expectation.",
    );
  }
  if (amountLogs.length !== 1) {
    throw semanticError(
      "Multiple qualifying Transfer logs make this delivery ambiguous.",
      "Use one ordinary ERC-20 transfer that emits exactly one qualifying log.",
    );
  }

  const transfer = amountLogs[0];
  if (transfer.amount !== (transferCall.args[1] as bigint)) {
    throw semanticError(
      "The authenticated Transfer amount does not match the direct transfer call.",
      "Do not prove this receipt; the selected token does not exhibit standard ERC-20 transfer behavior.",
    );
  }
  const transactionIndex = BigInt(receipt.index);
  const blockHeight = BigInt(receipt.blockNumber);
  const replayIdentity = deriveReplayIdentity(
    BigInt(expectation.sourceChainKey),
    blockHeight,
    transactionIndex,
  );

  return {
    foreignTxHash: hash,
    blockNumber: blockHeight.toString(),
    blockHash: receipt.blockHash as `0x${string}`,
    transactionIndex: transactionIndex.toString(),
    transactionTo: getAddress(transaction.to),
    receiptStatus: receipt.status,
    transferLogIndex: transfer.index.toString(),
    logEmitter: transfer.emitter,
    transferFrom: transfer.from,
    transferTo: transfer.to,
    transferAmount: transfer.amount.toString(),
    sourceTime: authenticated
      ? {
          kind: "authenticated-block-height",
          blockNumber: blockHeight.toString(),
          timestamp: "unavailable",
        }
      : { kind: "unavailable", timestamp: "unavailable" },
    replayIdentity: {
      chainKey: expectation.sourceChainKey.toString(),
      blockHeight: blockHeight.toString(),
      transactionIndex: transactionIndex.toString(),
      derived: replayIdentity,
    },
  };
}

export function createExpectation(input: {
  sender: string;
  recipient: string;
  amount: bigint;
}): TransferExpectation {
  return {
    sourceChainKey: config.foreign.sourceChainKey,
    sourceChainId: config.foreign.chainId,
    token: config.deliveryToken.address,
    sender: getAddress(input.sender),
    recipient: getAddress(input.recipient),
    minimumAmount: input.amount.toString(),
    transferTopic0: TRANSFER_TOPIC as `0x${string}`,
  };
}

function semanticError(message: string, recovery: string): AttestcoinError {
  return new AttestcoinError(
    "Comparing receipt semantics",
    "semantic_mismatch",
    message,
    recovery,
  );
}
