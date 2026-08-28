import type { Address, Hash, Hex } from "viem";

export type TestFundsAssetStatus =
  | "ready"
  | "submitted"
  | "unavailable"
  | "uncertain";

export type TestFundsAssetResult = {
  status: TestFundsAssetStatus;
  balance: string;
  target: string;
  amount?: string;
  transactionHash?: Hash;
  message?: string;
};

export type TestFundsClaimStatus =
  | "ready"
  | "submitted"
  | "partial"
  | "rate_limited"
  | "unavailable";

export type TestFundsResponse = {
  ok: boolean;
  status: TestFundsClaimStatus;
  address: Address;
  assets: {
    test: TestFundsAssetResult;
    btkt: TestFundsAssetResult;
  };
  retryAt?: string;
  message?: string;
};

export type UnsignedTestFundsClaim = {
  address: Address;
  origin: string;
  issuedAt: string;
  expiresAt: string;
  configVersion: string;
};

export type SignedTestFundsClaim = UnsignedTestFundsClaim & {
  signature: Hex;
};

export type TestFundsBalances = {
  sepoliaGas: bigint;
  test: bigint;
  creditcoinGas: bigint;
  btkt: bigint;
};
