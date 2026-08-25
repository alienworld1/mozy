export type Hex = `0x${string}`;

export interface TransferExpectation {
  sourceChainKey: number;
  sourceChainId: number;
  token: string;
  sender: string;
  recipient: string;
  minimumAmount: string;
  transferTopic0: Hex;
}

export interface ReceiptEvidence {
  foreignTxHash: Hex;
  blockNumber: string;
  blockHash: Hex;
  transactionIndex: string;
  transactionTo: string;
  receiptStatus: number;
  transferLogIndex: string;
  logEmitter: string;
  transferFrom: string;
  transferTo: string;
  transferAmount: string;
  sourceTime: {
    kind: "authenticated-block-height" | "unavailable";
    blockNumber?: string;
    timestamp: "unavailable";
  };
  replayIdentity: {
    chainKey: string;
    blockHeight: string;
    transactionIndex: string;
    derived: Hex;
  };
}

export interface StoredTransfer {
  schemaVersion: "1";
  foreignTxHash: Hex;
  createdAt: string;
  expectation: TransferExpectation;
  senderBalanceBefore: string;
  senderBalanceAfter: string;
  recipientBalanceBefore: string;
  recipientBalanceAfter: string;
}

export interface StoredProof {
  schemaVersion: "1";
  sourceTxHash: Hex;
  chainKey: number;
  headerNumber: number;
  txIndex: number;
  txHash: Hex;
  txBytes: Hex;
  merkleProof: {
    root: Hex;
    siblings: Array<{ hash: Hex; isLeft: boolean }>;
  };
  continuityProof: {
    lowerEndpointDigest: Hex;
    roots: Hex[];
  };
  cached: boolean;
  generatedAt: string;
}

export type SemanticCheckName =
  | "sourceChain"
  | "receiptSuccess"
  | "transactionTarget"
  | "token"
  | "sender"
  | "recipient"
  | "amount"
  | "sourceTiming"
  | "replayIdentity";

export type SemanticChecks = Record<SemanticCheckName, "pass">;
