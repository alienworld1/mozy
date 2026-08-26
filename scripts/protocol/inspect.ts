import { readFile } from "node:fs/promises";
import path from "node:path";
import { Contract, JsonRpcProvider, getAddress, id } from "ethers";
import { attestcoinEnvironment as config } from "../../config/attestcoin-environment.js";
import { projectRoot } from "../attestcoin/paths.js";
import { loadContractArtifact } from "./artifacts.js";
import type { ProtocolDeploymentArtifact } from "./deployment-artifact.js";
import { ProtocolCommandError } from "./errors.js";
import type { ProtocolOutput } from "./output.js";

export async function inspectProtocol(values: Record<string, string>, output: ProtocolOutput): Promise<void> {
  const rpcUrl = process.env[config.creditcoin.rpcEnv]?.trim();
  if (!rpcUrl) throw new ProtocolCommandError("Checking read-only inputs", `${config.creditcoin.rpcEnv} is not configured.`, "Set the public CC3 RPC URL; no signer is required.");
  const provider = new JsonRpcProvider(rpcUrl);
  if ((await provider.getNetwork()).chainId !== BigInt(config.creditcoin.chainId)) {
    throw new ProtocolCommandError("Checking read-only inputs", "The RPC is not connected to Creditcoin CC3 Testnet.", "Use the pinned CC3 RPC URL.");
  }

  const deployment = await resolveDeployment(values);
  if (
    deployment.schemaVersion !== "1"
    || deployment.chainId !== config.creditcoin.chainId
    || deployment.environmentConfigVersion !== config.configVersion
  ) throw mismatch("The deployment artifact does not match the pinned CC3 environment.");
  const [registryArtifact, marketArtifact, vaultArtifact] = await Promise.all([
    loadContractArtifact("MarketRegistry"),
    loadContractArtifact("MozyMarket"),
    loadContractArtifact("SettlementVault"),
  ]);
  const registry = new Contract(deployment.contracts.registry, registryArtifact.abi, provider);
  const market = new Contract(deployment.contracts.market, marketArtifact.abi, provider);
  const vault = new Contract(deployment.contracts.vault, vaultArtifact.abi, provider);

  output.phase("Checking live protocol wiring");
  const [registryCode, marketCode, vaultCode, registryOwner, marketOwner, wiredVault, vaultOperator, configHash, marketConfig, nextMandateId] = await Promise.all([
    provider.getCode(deployment.contracts.registry), provider.getCode(deployment.contracts.market), provider.getCode(deployment.contracts.vault),
    registry.owner() as Promise<string>, market.owner() as Promise<string>, market.vault() as Promise<string>, vault.marketOperator() as Promise<string>,
    registry.environmentConfigHash() as Promise<string>, registry.getMarket(1) as Promise<readonly unknown[]>, market.nextMandateId() as Promise<bigint>,
  ]);
  if ([registryCode, marketCode, vaultCode].some((code) => code === "0x")) throw mismatch("One or more recorded protocol addresses have no code.");
  if (getAddress(registryOwner) !== getAddress(deployment.protocolAdmin) || getAddress(marketOwner) !== getAddress(deployment.protocolAdmin)) throw mismatch("Live protocol ownership differs from the deployment artifact.");
  if (getAddress(wiredVault) !== getAddress(deployment.contracts.vault) || getAddress(vaultOperator) !== getAddress(deployment.contracts.market)) throw mismatch("The one-time market/vault wiring does not reconcile.");
  if (configHash !== id(config.configVersion) || configHash !== deployment.environmentConfigHash) throw mismatch("The live environment config hash does not match the pinned version.");
  if (
    BigInt(marketConfig[0] as bigint) !== BigInt(config.foreign.sourceChainKey)
    || getAddress(marketConfig[1] as string) !== getAddress(config.deliveryToken.address)
    || Number(marketConfig[2]) !== config.deliveryToken.decimals
    || getAddress(marketConfig[3] as string) !== getAddress(config.settlementToken.address)
    || Number(marketConfig[4]) !== config.settlementToken.decimals
    || marketConfig[5] !== true
  ) throw mismatch("Market 1 does not match the enabled release pins.");

  output.phase("Protocol", "configured and live");
  output.phase("Registry", deployment.contracts.registry);
  output.phase("MozyMarket", deployment.contracts.market);
  output.phase("SettlementVault", deployment.contracts.vault);
  output.phase("Market 1", "enabled");
  output.phase("Next mandate ID", nextMandateId.toString());
  if (nextMandateId === 1n) output.phase("Acquisition Mandates", "No mandates created");

  const mandateInput = values.mandate;
  if (mandateInput) await inspectMandate(BigInt(mandateInput), market, vault, output);
}

async function inspectMandate(idValue: bigint, market: Contract, vault: Contract, output: ProtocolOutput): Promise<void> {
  if (idValue <= 0n) throw new ProtocolCommandError("Validating mandate ID", "Mandate ID must be a positive integer.", "Pass --mandate with a canonical on-chain ID.");
  const [mandate, account, audit] = await Promise.all([
    market.getMandate(idValue) as Promise<readonly unknown[]>,
    vault.getAccount(idValue) as Promise<readonly unknown[]>,
    market.auditMandate(idValue) as Promise<readonly unknown[]>,
  ]);
  const statuses = ["Funding", "Open", "Paused", "Cancelled", "Expired", "Filled", "Closed"];
  output.phase(`Acquisition Mandate ${idValue}`, statuses[Number(mandate[13])]);
  output.phase("Buyer", mandate[1] as string);
  output.phase("Target amount", `${mandate[4]} delivery-token base units`);
  output.phase("Required funding", `${mandate[10]} BTKT base units`);
  output.phase("Funded", `${account[1]} BTKT base units`);
  output.phase("Free budget", `${account[4]} BTKT base units`);
  output.phase("Reserved budget", `${account[3]} BTKT base units`);
  output.phase("Spent budget", `${account[2]} BTKT base units`);
  output.phase("Refunded", `${account[5]} BTKT base units`);
  output.phase("Quantity reconciliation", audit[2] ? "pass" : "fail");
  output.phase("Budget reconciliation", audit[3] ? "pass" : "fail");
}

async function resolveDeployment(values: Record<string, string>): Promise<ProtocolDeploymentArtifact> {
  const suppliedAddresses = [values.registry, values.market, values.vault, values.admin].filter(Boolean).length;
  if (suppliedAddresses > 0 && suppliedAddresses < 4) {
    throw new ProtocolCommandError("Loading deployment addresses", "Direct inspection requires registry, market, vault, and admin together.", "Pass all four public values or omit them to use the canonical artifact.");
  }
  if (values.registry && values.market && values.vault && values.admin) {
    return {
      schemaVersion: "1", environmentConfigVersion: config.configVersion, environmentConfigHash: id(config.configVersion), chainId: config.creditcoin.chainId,
      deployedAt: "address-input", compiler: { version: "0.8.30", optimizer: true, optimizerRuns: 200, viaIr: true, evmVersion: "shanghai" },
      protocolAdmin: getAddress(values.admin), deployer: "0x0000000000000000000000000000000000000000",
      contracts: { registry: getAddress(values.registry), market: getAddress(values.market), vault: getAddress(values.vault) }, marketId: "1",
      transactions: { registryDeployment: "", marketDeployment: "", vaultDeployment: "", vaultConfiguration: "", marketConfiguration: "" },
    };
  }
  try {
    return JSON.parse(await readFile(path.join(projectRoot, "artifacts", "protocol", "cc3.json"), "utf8")) as ProtocolDeploymentArtifact;
  } catch {
    throw new ProtocolCommandError("Loading deployment addresses", "No canonical CC3 deployment artifact exists.", "Pass --registry, --market, --vault, and --admin to inspect live addresses directly.");
  }
}

function mismatch(message: string): ProtocolCommandError {
  return new ProtocolCommandError("Verifying live deployment", message, "Do not use this deployment for mandate funding. Reconcile the live reads and recorded addresses.");
}
