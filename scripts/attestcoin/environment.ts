import path from "node:path";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import { getAddress, isAddress } from "ethers";
import { z } from "zod";
import { attestcoinEnvironment } from "../../config/attestcoin-environment.js";
import { AttestcoinError } from "./errors.js";
import { projectRoot } from "./paths.js";

dotenv.config({ path: path.join(projectRoot, ".env"), override: false, quiet: true });

const placeholderPattern = /(?:replace|placeholder|example|your[_-]|<[^>]+>)/i;

const tokenSchema = z.object({
  address: z.string().min(1),
  symbol: z.string().min(1),
  decimals: z.number().int().min(0).max(255),
  fundingMethod: z.string().min(1),
});

const publicEnvironmentSchema = z
  .object({
    configVersion: z.string().min(1),
    verifiedAt: z.string().refine((value) => Number.isFinite(Date.parse(value)), "must be an ISO timestamp"),
    creditcoin: z.object({
      name: z.string().min(1),
      chainId: z.number().int().positive(),
      rpcEnv: z.string().min(1),
      explorerUrl: z.string().url(),
      nativeCurrency: z.object({ symbol: z.string().min(1), decimals: z.number().int().min(0).max(255) }),
    }),
    foreign: z.object({
      name: z.string().min(1),
      chainId: z.number().int().positive(),
      sourceChainKey: z.number().int().nonnegative(),
      rpcEnv: z.string().min(1),
      explorerUrl: z.string().url(),
      finalityOrAttestationRule: z.object({
        kind: z.literal("attested-height"),
        description: z.string().min(1),
        pollIntervalMs: z.number().int().positive(),
      }),
    }),
    deliveryToken: tokenSchema.extend({ behavior: z.literal("standard-erc20") }),
    settlementToken: tokenSchema,
    attestcoin: z.object({
      architectureVersion: z.string().min(1),
      verifierAddress: z.string().min(1),
      chainInfoAddress: z.string().min(1),
      decoderAddress: z.string().min(1),
      contractsPackage: z.string().min(1),
      sdkPackage: z.string().min(1),
      proofBuilderEnv: z.string().min(1),
      probeAddressEnv: z.string().min(1),
      interfaceFunctions: z.array(z.string().min(1)).min(1),
      decoder: z.string().min(1),
      upstream: z.object({ repository: z.string().url(), commit: z.string().regex(/^[0-9a-f]{40}$/) }),
    }),
    officialSourceRefs: z.array(z.string().url()).min(1),
  })
  .strict();

function requireHttps(value: string, field: string): void {
  try {
    if (new URL(value).protocol !== "https:") throw new Error();
  } catch {
    throw new AttestcoinError(
      "Checking configuration",
      "configuration_error",
      `Environment configuration is incomplete. Replace: ${field}.`,
      "Use the current official HTTPS endpoint.",
    );
  }
}

function requireChecksummedAddress(value: string, field: string): void {
  if (!isAddress(value) || getAddress(value) !== value) {
    throw new AttestcoinError(
      "Checking configuration",
      "configuration_error",
      `Environment configuration is incomplete. Replace: ${field}.`,
      "Pin the checksummed address from the current official source.",
    );
  }
}

export async function validatePublicConfiguration(): Promise<void> {
  const config = attestcoinEnvironment;
  const parsed = publicEnvironmentSchema.safeParse(config);
  if (!parsed.success || placeholderPattern.test(config.configVersion)) {
    const invalidFields = parsed.success
      ? "configVersion"
      : parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new AttestcoinError(
      "Checking configuration",
      "configuration_error",
      `Environment configuration is incomplete. Replace: ${invalidFields}.`,
      "Update the single config from current official sources before continuing.",
    );
  }

  requireHttps(config.creditcoin.explorerUrl, "creditcoin.explorerUrl");
  requireHttps(config.foreign.explorerUrl, "foreign.explorerUrl");
  requireChecksummedAddress(config.deliveryToken.address, "deliveryToken.address");
  requireChecksummedAddress(config.settlementToken.address, "settlementToken.address");
  requireChecksummedAddress(config.attestcoin.verifierAddress, "attestcoin.verifierAddress");
  requireChecksummedAddress(config.attestcoin.chainInfoAddress, "attestcoin.chainInfoAddress");
  requireChecksummedAddress(config.attestcoin.decoderAddress, "attestcoin.decoderAddress");

  const [contractsPackage, sdkPackage] = await Promise.all([
    installedVersion("@gluwa/usc-contracts"),
    installedVersion("@gluwa/usc-sdk"),
  ]);
  if (`@gluwa/usc-contracts@${contractsPackage}` !== config.attestcoin.contractsPackage) {
    throw packageMismatch("@gluwa/usc-contracts", config.attestcoin.contractsPackage);
  }
  if (`@gluwa/usc-sdk@${sdkPackage}` !== config.attestcoin.sdkPackage) {
    throw packageMismatch("@gluwa/usc-sdk", config.attestcoin.sdkPackage);
  }
}

async function installedVersion(packageName: string): Promise<string> {
  const packageFile = path.join(projectRoot, "node_modules", packageName, "package.json");
  try {
    return (JSON.parse(await readFile(packageFile, "utf8")) as { version: string }).version;
  } catch {
    throw new AttestcoinError(
      "Checking configuration",
      "configuration_error",
      `${packageName} is not installed.`,
      "Run pnpm install from the repository root.",
    );
  }
}

function packageMismatch(name: string, expected: string): AttestcoinError {
  return new AttestcoinError(
    "Checking configuration",
    "configuration_error",
    `${name} does not match the pinned official version ${expected}.`,
    "Run pnpm install and reconcile the lockfile with the pinned upstream revision.",
  );
}

export interface RuntimeEnvironment {
  creditcoinRpcUrl: string;
  foreignRpcUrl: string;
  proofBuilderUrl: string;
  privateKey: string;
  probeAddress: string;
}

export function loadRuntimeEnvironment(options: { requireSigner: boolean; requireProbe: boolean }): RuntimeEnvironment {
  const missing: string[] = [];
  const read = (name: string): string => {
    const value = process.env[name]?.trim() ?? "";
    if (!value || placeholderPattern.test(value)) missing.push(name);
    return value;
  };

  const creditcoinRpcUrl = read(attestcoinEnvironment.creditcoin.rpcEnv);
  const foreignRpcUrl = read(attestcoinEnvironment.foreign.rpcEnv);
  const proofBuilderUrl = read(attestcoinEnvironment.attestcoin.proofBuilderEnv);
  const privateKey = options.requireSigner ? read("ATTESTCOIN_DISPOSABLE_PRIVATE_KEY") : "";
  const probeAddress = options.requireProbe ? read(attestcoinEnvironment.attestcoin.probeAddressEnv) : "";

  if (missing.length > 0) {
    throw new AttestcoinError(
      "Checking configuration",
      "configuration_error",
      `Environment configuration is incomplete. Replace: ${missing.join(", ")}.`,
      "Copy .env.example to .env and provide testnet-only values.",
    );
  }

  for (const [value, field] of [
    [creditcoinRpcUrl, attestcoinEnvironment.creditcoin.rpcEnv],
    [foreignRpcUrl, attestcoinEnvironment.foreign.rpcEnv],
    [proofBuilderUrl, attestcoinEnvironment.attestcoin.proofBuilderEnv],
  ] as const) {
    requireHttps(value, field);
  }

  if (options.requireProbe && !isAddress(probeAddress)) {
    throw new AttestcoinError(
      "Checking configuration",
      "configuration_error",
      "Environment configuration is incomplete. Replace: ATTESTCOIN_PROBE_ADDRESS.",
      "Deploy ReceiptSemanticProbe to CC3 Testnet and record its address.",
    );
  }

  return { creditcoinRpcUrl, foreignRpcUrl, proofBuilderUrl, privateKey, probeAddress };
}
