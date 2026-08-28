import { releaseConfig } from "@mozy/chain-config";
import { getAddress, isAddress } from "viem";
import { z } from "zod";
import type {
  TestFundsBalances,
  UnsignedTestFundsClaim,
} from "./types";

export const testFundsClaimSchema = z.object({
  address: z.string().refine(isAddress).transform((value) => getAddress(value)),
  origin: z.string().url(),
  issuedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  configVersion: z.string().min(1),
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
});

export function buildTestFundsClaimStatement(claim: UnsignedTestFundsClaim) {
  return [
    "Mozy test funds request",
    "",
    `Wallet: ${claim.address}`,
    `Origin: ${claim.origin}`,
    `Release: ${claim.configVersion}`,
    `Issued at: ${claim.issuedAt}`,
    `Expires at: ${claim.expiresAt}`,
    "",
    "This signature requests testnet-only TEST and BTKT. It does not authorize a transfer from your wallet.",
  ].join("\n");
}

export function getTestFundsReadiness(balances: TestFundsBalances) {
  const testReady = balances.test >= releaseConfig.demoFunding.deliveryTokenTarget;
  const btktReady = balances.btkt >= releaseConfig.demoFunding.settlementTokenTarget;
  const gasReady = balances.sepoliaGas > 0n && balances.creditcoinGas > 0n;
  return {
    testReady,
    btktReady,
    gasReady,
    ready: testReady && btktReady && gasReady,
  };
}

export function topUpDeficit(balance: bigint, target: bigint) {
  return balance >= target ? 0n : target - balance;
}
