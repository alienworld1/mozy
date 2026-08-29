import { getAddress, isAddress } from "viem";

const uint256Maximum = (1n << 256n) - 1n;

export function isReservationId(value: string) {
  return /^[1-9]\d*$/.test(value) && BigInt(value) <= uint256Maximum;
}

function sameAddress(left: string | null, right: string) {
  return !!left && isAddress(left) && isAddress(right) && getAddress(left) === getAddress(right);
}

export function isStandardTransferEvidence(input: {
  receiptStatus: number | null;
  semanticStatus: string;
  transactionTo: string | null;
  transferFrom: string | null;
  transferTo: string | null;
  transferAmount: string | null;
  transferLogIndex: bigint | null;
  observedBlockNumber: bigint | null;
  transactionIndex: bigint | null;
  token: string;
  solver: string;
  recipient: string;
  deliveredAmount: string;
  expectedTransferLogIndex: bigint;
  blockHeight: bigint;
  expectedTransactionIndex: bigint;
}) {
  return (
    input.receiptStatus === 1 &&
    input.semanticStatus === "accepted" &&
    sameAddress(input.transactionTo, input.token) &&
    sameAddress(input.transferFrom, input.solver) &&
    sameAddress(input.transferTo, input.recipient) &&
    input.transferAmount === input.deliveredAmount &&
    input.transferLogIndex === input.expectedTransferLogIndex &&
    input.observedBlockNumber === input.blockHeight &&
    input.transactionIndex === input.expectedTransactionIndex
  );
}
