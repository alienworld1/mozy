import { Contract, Wallet, getAddress } from "ethers";
import { chainInfo, blockProver } from "@gluwa/usc-sdk";
import { attestcoinEnvironment as config } from "../../config/attestcoin-environment.js";
import { ERC20_ABI } from "./constants.js";
import { AttestcoinError } from "./errors.js";
import { createCreditcoinProvider, createForeignProvider } from "./providers.js";
import {
  loadRuntimeEnvironment,
  validatePublicConfiguration,
  type RuntimeEnvironment,
} from "./environment.js";

export interface PreflightResult {
  ok: true;
  configVersion: string;
  operator: string;
  networks: {
    creditcoin: { configuredChainId: number; connectedChainId: string };
    foreign: { configuredChainId: number; connectedChainId: string };
  };
  sourceChain: {
    chainKey: number;
    chainId: number;
    latestAttestedHeight: string;
    latestAttestedHash: string;
    proofBuilderAttestedHeight: string;
  };
  contracts: Record<string, { address: string; code: "present" | "precompile-responsive" }>;
  tokens: Record<string, { address: string; symbol: string; decimals: number; operatorBalance: string }>;
  balances: { foreignGas: string; creditcoinGas: string };
}

export async function runPreflight(): Promise<{ runtime: RuntimeEnvironment; result: PreflightResult }> {
  await validatePublicConfiguration();
  const runtime = loadRuntimeEnvironment({ requireSigner: true, requireProbe: true });

  let wallet: Wallet;
  try {
    wallet = new Wallet(runtime.privateKey);
  } catch {
    throw new AttestcoinError(
      "Checking configuration",
      "configuration_error",
      "ATTESTCOIN_DISPOSABLE_PRIVATE_KEY is invalid.",
      "Use a newly generated 32-byte testnet-only EVM private key.",
    );
  }

  const operator = wallet.address;
  const [creditcoinChainId, foreignChainId] = await Promise.all([
    readChainId(runtime.creditcoinRpcUrl, "Creditcoin CC3 Testnet"),
    readChainId(runtime.foreignRpcUrl, "Ethereum Sepolia"),
  ]);

  requireChainId("Creditcoin CC3 Testnet", creditcoinChainId, config.creditcoin.chainId);
  requireChainId("Ethereum Sepolia", foreignChainId, config.foreign.chainId);

  const creditcoinProvider = createCreditcoinProvider(runtime.creditcoinRpcUrl);
  const foreignProvider = createForeignProvider(runtime.foreignRpcUrl);

  const sourceToken = new Contract(config.deliveryToken.address, ERC20_ABI, foreignProvider);
  const settlementToken = new Contract(config.settlementToken.address, ERC20_ABI, creditcoinProvider);
  // The SDK bundles the same ethers version under a private package path; the cast only bridges
  // TypeScript's private-class identity split. The runtime provider API is the pinned ethers v6 API.
  const sdkProvider = creditcoinProvider as unknown as ConstructorParameters<
    typeof chainInfo.PrecompileChainInfoProvider
  >[0];
  const info = new chainInfo.PrecompileChainInfoProvider(sdkProvider, config.attestcoin.chainInfoAddress);
  const prover = new blockProver.PrecompileBlockProver(sdkProvider, config.attestcoin.verifierAddress);

  const [foreignChecks, creditcoinChecks, proofBuilderAttestedHeight] = await Promise.all([
    checkedNetworkGroup(
      "Ethereum Sepolia",
      () => Promise.all([
        foreignProvider.getCode(config.deliveryToken.address),
        sourceToken.symbol() as Promise<string>,
        sourceToken.decimals() as Promise<bigint>,
        sourceToken.balanceOf(operator) as Promise<bigint>,
        foreignProvider.getBalance(operator),
      ]),
    ),
    checkedNetworkGroup(
      "Creditcoin CC3 Testnet",
      () => Promise.all([
        creditcoinProvider.getCode(config.settlementToken.address),
        creditcoinProvider.getCode(runtime.probeAddress),
        creditcoinProvider.getCode(config.attestcoin.decoderAddress),
        info.getSupportedChains(),
        info.getLatestAttestedHeightAndHash(config.foreign.sourceChainKey),
        settlementToken.symbol() as Promise<string>,
        settlementToken.decimals() as Promise<bigint>,
        settlementToken.balanceOf(operator) as Promise<bigint>,
        creditcoinProvider.getBalance(operator),
        // An empty proof proves that the pinned precompile ABI responds, not that any receipt is valid.
        prover.computeTransactionIndex({ root: `0x${"00".repeat(32)}`, siblings: [] }),
      ]),
    ),
    checkedNetworkGroup("Attestcoin proof builder", () => readProofBuilderHeight(runtime.proofBuilderUrl)),
  ]);

  const [sourceTokenCode, sourceSymbol, sourceDecimals, sourceBalance, foreignGas] = foreignChecks;
  const [
    settlementTokenCode,
    probeCode,
    decoderCode,
    supportedChains,
    latestAttested,
    settlementSymbol,
    settlementDecimals,
    settlementBalance,
    creditcoinGas,
  ] = creditcoinChecks;

  requireCode(sourceTokenCode, "delivery token");
  requireCode(settlementTokenCode, "settlement token");
  requireCode(probeCode, "ReceiptSemanticProbe");
  requireCode(decoderCode, "EvmV1Decoder");

  const selectedChain = supportedChains.find((chain) => chain.chainKey === config.foreign.sourceChainKey);
  if (!selectedChain || selectedChain.chainId !== config.foreign.chainId || !latestAttested.exists) {
    throw new AttestcoinError(
      "Checking configuration",
      "configuration_error",
      "Attestcoin is not currently attesting the selected source chain on this Creditcoin environment.",
      "Stop before spending gas and reconcile the source chain key through live ChainInfo.",
    );
  }

  requireTokenMetadata("delivery", sourceSymbol, Number(sourceDecimals), config.deliveryToken);
  requireTokenMetadata("settlement", settlementSymbol, Number(settlementDecimals), config.settlementToken);

  if (foreignGas === 0n || creditcoinGas === 0n || sourceBalance === 0n || settlementBalance === 0n) {
    throw new AttestcoinError(
      "Checking configuration",
      "funding_error",
      "The disposable operator does not have all required testnet gas and token balances.",
      "Follow docs/attestcoin.md to fund Sepolia gas, TEST, CC3 tCTC, and BTKT before continuing.",
    );
  }

  return {
    runtime,
    result: {
      ok: true,
      configVersion: config.configVersion,
      operator,
      networks: {
        creditcoin: { configuredChainId: config.creditcoin.chainId, connectedChainId: creditcoinChainId.toString() },
        foreign: { configuredChainId: config.foreign.chainId, connectedChainId: foreignChainId.toString() },
      },
      sourceChain: {
        chainKey: selectedChain.chainKey,
        chainId: selectedChain.chainId,
        latestAttestedHeight: latestAttested.height.toString(),
        latestAttestedHash: latestAttested.hash,
        proofBuilderAttestedHeight: proofBuilderAttestedHeight.toString(),
      },
      contracts: {
        verifier: { address: config.attestcoin.verifierAddress, code: "precompile-responsive" },
        chainInfo: { address: config.attestcoin.chainInfoAddress, code: "precompile-responsive" },
        decoder: { address: config.attestcoin.decoderAddress, code: "present" },
        probe: { address: getAddress(runtime.probeAddress), code: "present" },
      },
      tokens: {
        delivery: {
          address: config.deliveryToken.address,
          symbol: sourceSymbol,
          decimals: Number(sourceDecimals),
          operatorBalance: sourceBalance.toString(),
        },
        settlement: {
          address: config.settlementToken.address,
          symbol: settlementSymbol,
          decimals: Number(settlementDecimals),
          operatorBalance: settlementBalance.toString(),
        },
      },
      balances: { foreignGas: foreignGas.toString(), creditcoinGas: creditcoinGas.toString() },
    },
  };
}

function requireChainId(name: string, actual: bigint, expected: number): void {
  if (actual !== BigInt(expected)) {
    throw new AttestcoinError(
      "Checking configuration",
      "configuration_error",
      `Configured ${name} chain ID does not match the connected RPC.`,
      "Select the configured RPC before any transaction is sent.",
    );
  }
}

function requireCode(code: string, label: string): void {
  if (code === "0x") {
    throw new AttestcoinError(
      "Checking configuration",
      "configuration_error",
      `The configured ${label} address has no deployed code.`,
      "Reconcile the address and selected network before continuing.",
    );
  }
}

function requireTokenMetadata(
  label: string,
  symbol: string,
  decimals: number,
  expected: { symbol: string; decimals: number },
): void {
  if (symbol !== expected.symbol || decimals !== expected.decimals) {
    throw new AttestcoinError(
      "Checking configuration",
      "configuration_error",
      `The configured ${label} token does not match the live contract.`,
      "Stop and reconcile the token address, symbol, and decimals from live bytecode.",
    );
  }
}

async function readProofBuilderHeight(baseUrl: string): Promise<number> {
  const endpoint = new URL(`/api/v1/attested-height/${config.foreign.sourceChainKey}`, baseUrl);
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`proof builder returned HTTP ${response.status}`);
  const body = (await response.json()) as { attestedHeight?: unknown };
  if (!Number.isSafeInteger(body.attestedHeight) || Number(body.attestedHeight) < 0) {
    throw new Error("proof builder returned an invalid attested height");
  }
  return Number(body.attestedHeight);
}

async function readChainId(rpcUrl: string, networkName: string): Promise<bigint> {
  let response: Response | undefined;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
        signal: AbortSignal.timeout(12_000),
      });
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await delay(500 * 2 ** attempt);
    }
  }
  if (!response) {
    const code = networkErrorCode(lastError);
    throw new AttestcoinError(
      `Checking ${networkName} RPC`,
      "configuration_error",
      `${networkName} RPC did not respond after three attempts${code ? ` (${code})` : ""}.`,
      `Replace its RPC environment value with a reachable HTTPS ${networkName} endpoint, then rerun preflight.`,
    );
  }

  if (!response.ok) {
    throw new AttestcoinError(
      `Checking ${networkName} RPC`,
      "configuration_error",
      `${networkName} RPC returned HTTP ${response.status}.`,
      "Check the provider URL, API key, access policy, and rate limit, then rerun preflight.",
    );
  }

  const body = (await response.json()) as { result?: unknown; error?: { code?: unknown; message?: unknown } };
  if (body.error) {
    throw new AttestcoinError(
      `Checking ${networkName} RPC`,
      "configuration_error",
      `${networkName} RPC rejected eth_chainId with code ${String(body.error.code ?? "unknown")}.`,
      "Check the provider URL, API key permissions, and network selection, then rerun preflight.",
    );
  }
  if (typeof body.result !== "string" || !/^0x[0-9a-f]+$/i.test(body.result)) {
    throw new AttestcoinError(
      `Checking ${networkName} RPC`,
      "configuration_error",
      `${networkName} RPC returned an invalid eth_chainId result.`,
      "Use a standard EVM JSON-RPC HTTPS endpoint for the selected network.",
    );
  }
  return BigInt(body.result);
}

function networkErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { code?: unknown; cause?: { code?: unknown; errors?: Array<{ code?: unknown }> } };
  const code = candidate.code ?? candidate.cause?.code ?? candidate.cause?.errors?.[0]?.code;
  return typeof code === "string" ? code : undefined;
}

async function checkedNetworkGroup<T>(name: string, operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === 0) await delay(500);
    }
  }
  const code = networkErrorCode(lastError);
  throw new AttestcoinError(
    `Checking ${name}`,
    "configuration_error",
    `${name} did not respond to a required read-only check after two attempts${code ? ` (${code})` : ""}.`,
    `Check the configured ${name} endpoint, provider access, and rate limit, then rerun preflight.`,
  );
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
