import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  Contract,
  ContractFactory,
  JsonRpcProvider,
  Wallet,
  ZeroAddress,
  getAddress,
  id,
} from "ethers";
import { attestcoinEnvironment as config } from "../../config/attestcoin-environment.js";
import { validatePublicConfiguration } from "../attestcoin/environment.js";
import { evidenceCheckCommand } from "../attestcoin/commands/evidence-check-command.js";
import { CommandOutput } from "../attestcoin/output.js";
import { projectRoot } from "../attestcoin/paths.js";
import { loadContractArtifact } from "./artifacts.js";
import type { ProtocolDeploymentArtifact } from "./deployment-artifact.js";
import { ProtocolCommandError } from "./errors.js";
import type { ProtocolOutput } from "./output.js";

const erc20MetadataAbi = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
];

const BOND_RATE_BPS = 100n;
const BOND_CAP = 10n * 10n ** BigInt(config.settlementToken.decimals);

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim() ?? "";
  if (!value) {
    throw new ProtocolCommandError(
      "Checking deployment inputs",
      `${name} is not configured.`,
      "Set every documented disposable testnet deployment variable in .env before retrying.",
    );
  }
  return value;
}

export async function deployProtocol(output: ProtocolOutput): Promise<void> {
  const deploymentPath = path.join(projectRoot, "artifacts", "protocol", "cc3-module3.json");
  try {
    await access(deploymentPath);
    throw new ProtocolCommandError(
      "Checking deployment state",
      "A canonical CC3 deployment artifact already exists.",
      "Inspect the recorded deployment. Do not redeploy unless a deliberate migration is approved.",
    );
  } catch (error) {
    if (error instanceof ProtocolCommandError) throw error;
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  output.phase("Checking pinned protocol configuration");
  await evidenceCheckCommand(new CommandOutput(false));
  await validatePublicConfiguration();

  const rpcUrl = requiredEnvironment(config.creditcoin.rpcEnv);
  const privateKey = requiredEnvironment("MOZY_DEPLOYER_PRIVATE_KEY");
  const protocolAdmin = getAddress(requiredEnvironment("MOZY_PROTOCOL_ADMIN"));
  if (protocolAdmin === ZeroAddress) {
    throw new ProtocolCommandError("Checking deployment inputs", "The protocol admin cannot be zero.", "Set MOZY_PROTOCOL_ADMIN to the intended narrow policy owner.");
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const signer = new Wallet(privateKey, provider);
  const deployer = await signer.getAddress();
  if (protocolAdmin !== deployer) {
    throw new ProtocolCommandError(
      "Checking deployment inputs",
      "The deterministic deployer must also be the initial protocol admin.",
      "Set MOZY_PROTOCOL_ADMIN to the disposable deployer address, or perform an explicitly reviewed manual deployment.",
    );
  }
  output.phase("Checking Creditcoin deployment environment", deployer);
  const network = await provider.getNetwork();
  if (network.chainId !== BigInt(config.creditcoin.chainId)) {
    throw new ProtocolCommandError(
      "Checking Creditcoin deployment environment",
      `Connected chain ID ${network.chainId} does not match ${config.creditcoin.chainId}.`,
      "Use the pinned Creditcoin CC3 Testnet RPC URL.",
    );
  }
  const settlementCode = await provider.getCode(config.settlementToken.address);
  if (settlementCode === "0x") throw new ProtocolCommandError("Checking BTKT", "The pinned BTKT address has no code.", "Reconcile the pinned environment before deployment.");
  const token = new Contract(config.settlementToken.address, erc20MetadataAbi, provider);
  const [nativeBalance, tokenDecimals, tokenBalance] = await Promise.all([
    provider.getBalance(deployer),
    token.decimals() as Promise<bigint>,
    token.balanceOf(deployer) as Promise<bigint>,
  ]);
  if (tokenDecimals !== BigInt(config.settlementToken.decimals)) throw new ProtocolCommandError("Checking BTKT", "BTKT decimals do not match the release pin.", "Stop and reconcile the live token metadata.");
  if (nativeBalance === 0n || tokenBalance === 0n) throw new ProtocolCommandError("Checking deployer funding", "The deployer needs both tCTC for gas and BTKT for the canonical mandate path.", "Fund the disposable CC3 account before deployment.");

  const [registryArtifact, marketArtifact, vaultArtifact] = await Promise.all([
    loadContractArtifact("MarketRegistry"),
    loadContractArtifact("MozyMarket"),
    loadContractArtifact("SettlementVault"),
  ]);
  const configHash = id(config.configVersion);
  const explorer = config.creditcoin.explorerUrl;

  output.phase("Deploying MarketRegistry");
  const registry = await new ContractFactory(registryArtifact.abi, registryArtifact.bytecode.object, signer).deploy(
    protocolAdmin,
    config.foreign.sourceChainKey,
    config.deliveryToken.address,
    config.deliveryToken.decimals,
    config.settlementToken.address,
    config.settlementToken.decimals,
    configHash,
  );
  const registryTx = registry.deploymentTransaction();
  if (!registryTx) throw new Error("MarketRegistry deployment transaction is unavailable");
  output.transaction("MarketRegistry submitted", registryTx.hash, explorer);
  await registry.waitForDeployment();

  output.phase("Deploying MozyMarket");
  const market = await new ContractFactory(marketArtifact.abi, marketArtifact.bytecode.object, signer).deploy(
    protocolAdmin,
    await registry.getAddress(),
    BOND_RATE_BPS,
    BOND_CAP,
  );
  const marketTx = market.deploymentTransaction();
  if (!marketTx) throw new Error("MozyMarket deployment transaction is unavailable");
  output.transaction("MozyMarket submitted", marketTx.hash, explorer);
  await market.waitForDeployment();

  output.phase("Deploying SettlementVault");
  const vault = await new ContractFactory(vaultArtifact.abi, vaultArtifact.bytecode.object, signer).deploy(await market.getAddress());
  const vaultTx = vault.deploymentTransaction();
  if (!vaultTx) throw new Error("SettlementVault deployment transaction is unavailable");
  output.transaction("SettlementVault submitted", vaultTx.hash, explorer);
  await vault.waitForDeployment();

  output.phase("Completing one-time vault wiring");
  const configuredMarket = market.connect(signer) as Contract;
  const configuredRegistry = registry.connect(signer) as Contract;
  const vaultConfigTx = await configuredMarket.configureVault(await vault.getAddress());
  output.transaction("Vault wiring submitted", vaultConfigTx.hash, explorer);
  await vaultConfigTx.wait();
  const marketConfigTx = await configuredRegistry.configureReleaseMarket([
    config.foreign.sourceChainKey,
    config.deliveryToken.address,
    config.deliveryToken.decimals,
    config.settlementToken.address,
    config.settlementToken.decimals,
    true,
  ]);
  output.transaction("Release market configuration submitted", marketConfigTx.hash, explorer);
  await marketConfigTx.wait();

  const artifact: ProtocolDeploymentArtifact = {
    schemaVersion: "2",
    environmentConfigVersion: config.configVersion,
    environmentConfigHash: configHash,
    chainId: config.creditcoin.chainId,
    deployedAt: new Date().toISOString(),
    compiler: { version: "0.8.30", optimizer: true, optimizerRuns: 200, viaIr: true, evmVersion: "shanghai" },
    protocolAdmin,
    deployer,
    contracts: { registry: await registry.getAddress(), market: await market.getAddress(), vault: await vault.getAddress() },
    marketId: "1",
    bondPolicy: { rateBps: BOND_RATE_BPS.toString(), cap: BOND_CAP.toString(), denominator: "10000" },
    transactions: {
      registryDeployment: registryTx.hash,
      marketDeployment: marketTx.hash,
      vaultDeployment: vaultTx.hash,
      vaultConfiguration: vaultConfigTx.hash,
      marketConfiguration: marketConfigTx.hash,
    },
  };
  const artifactDirectory = path.join(projectRoot, "artifacts", "protocol");
  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(deploymentPath, `${JSON.stringify(artifact, null, 2)}\n`, { flag: "wx" });
  output.phase("Protocol deployed and wired", `Market 1 is enabled; next mandate ID is 1`);
  output.phase("Bond policy", `${BOND_RATE_BPS} bps, capped at ${BOND_CAP} BTKT base units`);
  output.phase("Deployment artifact", "artifacts/protocol/cc3-module3.json");
}
