export type DeliveryReceipt = {
  mandateId: string;
  reservationId: string;
  settledAt: string;
  foreign: {
    chainId: string;
    chainName: string;
    sourceChainKey: string;
    tokenAddress: string;
    tokenSymbol: string;
    tokenDecimals: number;
    sender: string;
    recipient: string;
    observedAmount: string;
    creditedAmount: string;
    transactionHash: string;
    transactionTo: string | null;
    receiptStatus: "successful";
    transferLogIndex: string;
    blockHeight: string;
    transactionIndex: string;
    standardTransferVerified: boolean;
    directDeliveryVerified: boolean;
    explorerUrl: string;
  };
  verification: {
    protocol: "Attestcoin";
    version: string | null;
    status: "verified";
    replayIdentity: string;
    replayStatus: "consumed";
  };
  creditcoin: {
    chainId: string;
    chainName: string;
    transactionHash: string;
    payoutAmount: string;
    payoutTokenAddress: string;
    payoutTokenSymbol: string;
    payoutTokenDecimals: number;
    payoutRecipient: string;
    returnedBond: string;
    relayer: string;
    explorerUrl: string;
  };
};

type ReceiptFailureStatus =
  | "pending"
  | "rebuilding"
  | "inconsistent"
  | "unavailable"
  | "not_found";

type ReceiptFailure = {
  [Status in ReceiptFailureStatus]: { status: Status; message: string };
}[ReceiptFailureStatus];

export type ReceiptResponse =
  | { status: "complete"; receipt: DeliveryReceipt }
  | ReceiptFailure;
