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
  creationBlock?: bigint;
  transactionHash?: Hash;
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
