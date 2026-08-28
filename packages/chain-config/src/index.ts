import { attestcoinEnvironment } from "../../../config/attestcoin-environment";
import settlementDeployment from "../../../artifacts/protocol/cc3-settlement.json";
import { getAddress, isAddress, zeroAddress } from "viem";
import { defineChain } from "viem";
import { z } from "zod";

const absoluteRpcUrl = z
  .string()
  .min(1)
  .url()
  .refine((value) => ["https:", "wss:"].includes(new URL(value).protocol), {
    message: "must use HTTPS or WSS",
  });

const address = z
  .string()
  .refine((value) => isAddress(value) && getAddress(value) !== zeroAddress, {
    message: "must be a valid non-zero EVM address",
  })
  .transform((value) => getAddress(value));

const deploymentSchema = z.object({
  environmentConfigVersion: z.string().min(1),
  chainId: z.number().int().positive(),
  contracts: z.object({
    registry: address,
    market: address,
    vault: address,
    settlement: address,
  }),
  marketId: z.string().regex(/^\d+$/),
  deploymentBlock: z.string().regex(/^\d+$/),
});

const browserEnvironmentSchema = z.object({
  creditcoinRpcUrl: absoluteRpcUrl,
  foreignRpcUrl: absoluteRpcUrl,
});

function configurationError(cause: unknown): never {
  const detail = cause instanceof Error ? cause.message : "Unknown validation error";
  throw new Error(`Mozy release configuration is invalid: ${detail}`);
}

let deployment: z.infer<typeof deploymentSchema>;
let browserEnvironment: z.infer<typeof browserEnvironmentSchema>;

try {
  deployment = deploymentSchema.parse(settlementDeployment);
  browserEnvironment = browserEnvironmentSchema.parse({
    creditcoinRpcUrl: process.env.NEXT_PUBLIC_CREDITCOIN_RPC_URL,
    foreignRpcUrl: process.env.NEXT_PUBLIC_FOREIGN_RPC_URL,
  });
} catch (error) {
  configurationError(error);
}

if (
  deployment.environmentConfigVersion !== attestcoinEnvironment.configVersion ||
  deployment.chainId !== attestcoinEnvironment.creditcoin.chainId
) {
  configurationError(new Error("environment and deployment versions do not match"));
}

export const creditcoinChain = defineChain({
  id: attestcoinEnvironment.creditcoin.chainId,
  name: attestcoinEnvironment.creditcoin.name,
  nativeCurrency: {
    name: attestcoinEnvironment.creditcoin.nativeCurrency.symbol,
    symbol: attestcoinEnvironment.creditcoin.nativeCurrency.symbol,
    decimals: attestcoinEnvironment.creditcoin.nativeCurrency.decimals,
  },
  rpcUrls: {
    default: { http: [browserEnvironment.creditcoinRpcUrl] },
  },
  blockExplorers: {
    default: {
      name: "Creditcoin Testnet Explorer",
      url: attestcoinEnvironment.creditcoin.explorerUrl,
    },
  },
  testnet: true,
});

export const deliveryChain = defineChain({
  id: attestcoinEnvironment.foreign.chainId,
  name: attestcoinEnvironment.foreign.name,
  nativeCurrency: {
    name: "Sepolia Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [browserEnvironment.foreignRpcUrl] },
  },
  blockExplorers: {
    default: {
      name: "Ethereum Sepolia Explorer",
      url: attestcoinEnvironment.foreign.explorerUrl,
    },
  },
  testnet: true,
});

export const releaseConfig = Object.freeze({
  configVersion: attestcoinEnvironment.configVersion,
  creditcoin: {
    ...creditcoinChain,
    role: "Settlement network" as const,
  },
  foreign: {
    ...deliveryChain,
    role: "Delivery network" as const,
  },
  deliveryToken: {
    address: address.parse(attestcoinEnvironment.deliveryToken.address),
    symbol: attestcoinEnvironment.deliveryToken.symbol,
    decimals: attestcoinEnvironment.deliveryToken.decimals,
  },
  settlementToken: {
    address: address.parse(attestcoinEnvironment.settlementToken.address),
    symbol: attestcoinEnvironment.settlementToken.symbol,
    decimals: attestcoinEnvironment.settlementToken.decimals,
  },
  demoFunding: {
    deliveryTokenTarget: 100n * 10n ** BigInt(attestcoinEnvironment.deliveryToken.decimals),
    settlementTokenTarget: 100n * 10n ** BigInt(attestcoinEnvironment.settlementToken.decimals),
    sepoliaGasFaucetUrl: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia",
    creditcoinGasFaucetUrl: "https://docs.creditcoin.org/wallets/using-testnet-faucet",
  },
  contracts: deployment.contracts,
  marketId: deployment.marketId,
  deploymentBlock: BigInt(deployment.deploymentBlock),
});

export const supportedChains = [creditcoinChain, deliveryChain] as const;

export type SupportedChainId = (typeof supportedChains)[number]["id"];
