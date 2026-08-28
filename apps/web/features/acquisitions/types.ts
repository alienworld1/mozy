import type { Address, Hash } from "viem";

export const mandateStatuses = [
  "Funding",
  "Open",
  "Paused",
  "Cancelled",
  "Expired",
  "Filled",
  "Closed",
] as const;

export type MandateStatus = (typeof mandateStatuses)[number];
export type PricingMode = "Limit" | "Range";

export type Mandate = {
  id: bigint;
  buyer: Address;
  marketId: bigint;
  deliveryWallet: Address;
  targetAmount: bigint;
  acquiredAmount: bigint;
  reservedAmount: bigint;
  pricingMode: number;
  startPrice: bigint;
  endPrice: bigint;
  requiredFunding: bigint;
  mandateExpiry: bigint;
  reservationDuration: bigint;
  status: number;
  createdAt: bigint;
};

export type VaultAccount = {
  token: Address;
  funded: bigint;
  spent: bigint;
  reserved: bigint;
  free: bigint;
  refunded: bigint;
};

export type Acquisition = {
  mandate: Mandate;
  account: VaultAccount;
  snapshotBlock?: bigint;
  creationBlock?: bigint;
  transactionHash?: Hash;
};

export type Reservation = {
  id: bigint;
  mandateId: bigint;
  solver: Address;
  quantity: bigint;
  lockedPayout: bigint;
  bondAmount: bigint;
  createdAt: bigint;
  deliveryDeadline: bigint;
  sourceStartHeight: bigint;
  sourceEndHeight: bigint;
  expiryEligibleHeight: bigint;
  status: number;
};

export type InstrumentModel = {
  targetQuantity: bigint;
  settledQuantity: bigint;
  reservedQuantity: bigint;
  openQuantity: bigint;
  currentPosition: bigint;
  pricingMode: PricingMode;
  startPrice: bigint;
  endPrice: bigint;
  snapshotBlock: bigint;
};

export type FillQuote = {
  quantity: bigint;
  startPosition: bigint;
  endPosition: bigint;
  payout: bigint;
  quotedAtBlock: bigint;
};

export const reservationEligibilities = [
  "Eligible",
  "Protocol paused",
  "Market disabled",
  "Mandate not open",
  "Insufficient lifetime",
  "Insufficient payout budget",
] as const;

export const reservationStatuses = ["Active", "Expired", "Settled"] as const;

export type ReservationQuote = {
  mandateId: bigint;
  startPosition: bigint;
  quantity: bigint;
  endPosition: bigint;
  payout: bigint;
  bondAmount: bigint;
  reservationDuration: bigint;
  eligibleUntil: bigint;
  sourceChainKey: bigint;
  foreignToken: Address;
  deliveryWallet: Address;
  settlementToken: Address;
  eligibility: number;
  quotedAtBlock: bigint;
  quotedAtTimestamp: bigint;
};

export type ReservationRequirements = {
  market: {
    sourceChainKey: bigint;
    foreignToken: Address;
    foreignTokenDecimals: number;
    settlementToken: Address;
    settlementTokenDecimals: number;
    enabled: boolean;
  };
  deliveryWallet: Address;
  settlementToken: Address;
};

export type OwnedAcquisitionResult =
  | { mandateId: bigint; acquisition: Acquisition; unavailable?: never }
  | { mandateId: bigint; acquisition?: never; unavailable: true };

export type ParsedAcquisitionTerms = {
  deliveryWallet: Address;
  targetAmount: bigint;
  pricingMode: 0 | 1;
  startPrice: bigint;
  endPrice: bigint;
  mandateExpiry: bigint;
  reservationDuration: bigint;
};
