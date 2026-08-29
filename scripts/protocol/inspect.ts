import { readFile } from "node:fs/promises";
import path from "node:path";
import { Contract, JsonRpcProvider, getAddress, id } from "ethers";
import { attestcoinEnvironment as config } from "../../config/attestcoin-environment.js";
import { projectRoot } from "../attestcoin/paths.js";
import { loadContractArtifact } from "./artifacts.js";
import type { ProtocolDeploymentArtifact } from "./deployment-artifact.js";
import { ProtocolCommandError } from "./errors.js";
import type { ProtocolOutput } from "./output.js";

export async function inspectProtocol(
  values: Record<string, string>,
  output: ProtocolOutput,
): Promise<void> {
  const rpcUrl = process.env[config.creditcoin.rpcEnv]?.trim();
  if (!rpcUrl)
    throw new ProtocolCommandError(
      "Checking read-only inputs",
      `${config.creditcoin.rpcEnv} is not configured.`,
      "Set the public CC3 RPC URL; no signer is required.",
    );
  const provider = new JsonRpcProvider(rpcUrl);
  if (
    (await provider.getNetwork()).chainId !== BigInt(config.creditcoin.chainId)
  ) {
    throw new ProtocolCommandError(
      "Checking read-only inputs",
      "The RPC is not connected to Creditcoin CC3 Testnet.",
      "Use the pinned CC3 RPC URL.",
    );
  }

  const deployment = await resolveDeployment(values);
  if (
    deployment.schemaVersion !== "3" ||
    deployment.chainId !== config.creditcoin.chainId ||
    deployment.environmentConfigVersion !== config.configVersion
  )
    throw mismatch(
      "The deployment artifact does not match the pinned CC3 environment.",
    );
  const [registryArtifact, marketArtifact, vaultArtifact, settlementArtifact] =
    await Promise.all([
      loadContractArtifact("MarketRegistry"),
      loadContractArtifact("MozyMarket"),
      loadContractArtifact("SettlementVault"),
      loadContractArtifact("MozySettlement"),
    ]);
  const registry = new Contract(
    deployment.contracts.registry,
    registryArtifact.abi,
    provider,
  );
  const market = new Contract(
    deployment.contracts.market,
    marketArtifact.abi,
    provider,
  );
  const vault = new Contract(
    deployment.contracts.vault,
    vaultArtifact.abi,
    provider,
  );
  const settlement = new Contract(
    deployment.contracts.settlement,
    settlementArtifact.abi,
    provider,
  );

  output.phase("Checking live protocol wiring");
  const [
    registryCode,
    marketCode,
    vaultCode,
    settlementCode,
    registryOwner,
    marketOwner,
    wiredVault,
    wiredSettlement,
    vaultOperator,
    settlementMarket,
    settlementVerifier,
    chainInfo,
    sourceWindowBlocks,
    graceBlocks,
    configHash,
    marketConfig,
    nextMandateId,
    nextReservationId,
    bondRateBps,
    bondCap,
  ] = await Promise.all([
    provider.getCode(deployment.contracts.registry),
    provider.getCode(deployment.contracts.market),
    provider.getCode(deployment.contracts.vault),
    provider.getCode(deployment.contracts.settlement),
    registry.owner() as Promise<string>,
    market.owner() as Promise<string>,
    market.vault() as Promise<string>,
    market.settlementOperator() as Promise<string>,
    vault.marketOperator() as Promise<string>,
    settlement.market() as Promise<string>,
    settlement.verifier() as Promise<string>,
    market.chainInfo() as Promise<string>,
    market.sourceWindowBlocks() as Promise<bigint>,
    market.settlementGraceBlocks() as Promise<bigint>,
    registry.environmentConfigHash() as Promise<string>,
    registry.getMarket(1) as Promise<readonly unknown[]>,
    market.nextMandateId() as Promise<bigint>,
    market.nextReservationId() as Promise<bigint>,
    market.bondRateBps() as Promise<bigint>,
    market.bondCap() as Promise<bigint>,
  ]);
  if (
    [registryCode, marketCode, vaultCode, settlementCode].some(
      (code) => code === "0x",
    )
  )
    throw mismatch("One or more recorded protocol addresses have no code.");
  if (
    getAddress(registryOwner) !== getAddress(deployment.protocolAdmin) ||
    getAddress(marketOwner) !== getAddress(deployment.protocolAdmin)
  )
    throw mismatch(
      "Live protocol ownership differs from the deployment artifact.",
    );
  if (
    getAddress(wiredVault) !== getAddress(deployment.contracts.vault) ||
    getAddress(vaultOperator) !== getAddress(deployment.contracts.market)
  )
    throw mismatch("The one-time market/vault wiring does not reconcile.");
  if (
    getAddress(wiredSettlement) !==
      getAddress(deployment.contracts.settlement) ||
    getAddress(settlementMarket) !== getAddress(deployment.contracts.market) ||
    getAddress(settlementVerifier) !==
      getAddress(deployment.contracts.verifier) ||
    getAddress(chainInfo) !== getAddress(deployment.contracts.chainInfo)
  )
    throw mismatch(
      "The settlement and authenticated-height wiring does not reconcile.",
    );
  if (
    configHash !== id(config.configVersion) ||
    configHash !== deployment.environmentConfigHash
  )
    throw mismatch(
      "The live environment config hash does not match the pinned version.",
    );
  if (
    BigInt(marketConfig[0] as bigint) !==
      BigInt(config.foreign.sourceChainKey) ||
    getAddress(marketConfig[1] as string) !==
      getAddress(config.deliveryToken.address) ||
    Number(marketConfig[2]) !== config.deliveryToken.decimals ||
    getAddress(marketConfig[3] as string) !==
      getAddress(config.settlementToken.address) ||
    Number(marketConfig[4]) !== config.settlementToken.decimals ||
    marketConfig[5] !== true
  )
    throw mismatch("Market 1 does not match the enabled release pins.");
  if (
    deployment.deployedAt !== "address-input" &&
    (bondRateBps.toString() !== deployment.bondPolicy.rateBps ||
      bondCap.toString() !== deployment.bondPolicy.cap)
  )
    throw mismatch("Live bond policy differs from the deployment artifact.");
  if (
    deployment.deployedAt !== "address-input" &&
    (sourceWindowBlocks.toString() !==
      deployment.sourceWindowPolicy.acceptedBlocks ||
      graceBlocks.toString() !==
        deployment.sourceWindowPolicy.settlementGraceBlocks)
  )
    throw mismatch(
      "Live source-height policy differs from the deployment artifact.",
    );

  output.phase("Protocol", "configured and live");
  output.phase("Registry", deployment.contracts.registry);
  output.phase("MozyMarket", deployment.contracts.market);
  output.phase("SettlementVault", deployment.contracts.vault);
  output.phase("MozySettlement", deployment.contracts.settlement);
  output.phase("Attestcoin verifier", deployment.contracts.verifier);
  output.phase("Attestcoin ChainInfo", deployment.contracts.chainInfo);
  output.phase("EvmV1Decoder", deployment.contracts.decoder);
  output.phase("Market 1", "enabled");
  output.phase("Reservation bond rate", `${bondRateBps} bps`);
  output.phase("Reservation bond cap", `${bondCap} BTKT base units`);
  output.phase(
    "Accepted source window",
    `${sourceWindowBlocks} blocks, inclusive`,
  );
  output.phase("Settlement grace", `${graceBlocks} attested source blocks`);
  output.phase("Next mandate ID", nextMandateId.toString());
  output.phase("Next reservation ID", nextReservationId.toString());
  if (nextMandateId === 1n)
    output.phase("Acquisition Mandates", "No mandates created");
  if (nextReservationId === 1n)
    output.phase("Reservations", "No reservations created for this protocol");

  const mandateInput = values.mandate;
  if (mandateInput)
    await inspectMandate(BigInt(mandateInput), market, vault, output);
  const reservationInput = values.reservation;
  if (reservationInput)
    await inspectReservation(BigInt(reservationInput), market, vault, output);
  const receiptInput = values.receipt;
  if (receiptInput) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(receiptInput))
      throw new ProtocolCommandError(
        "Validating receipt identity",
        "Receipt identity must be exactly 32 bytes.",
        "Pass the canonical replay identity from settlement output.",
      );
    const boundReservation = (await settlement.receiptReservation(
      receiptInput,
    )) as bigint;
    output.phase(
      "Receipt consumption",
      boundReservation === 0n
        ? "Receipt has not been consumed"
        : `Consumed by reservation ${boundReservation}`,
    );
  }
}

async function inspectMandate(
  idValue: bigint,
  market: Contract,
  vault: Contract,
  output: ProtocolOutput,
): Promise<void> {
  if (idValue <= 0n)
    throw new ProtocolCommandError(
      "Validating mandate ID",
      "Mandate ID must be a positive integer.",
      "Pass --mandate with a canonical on-chain ID.",
    );
  const [mandate, account, audit] = await Promise.all([
    market.getMandate(idValue) as Promise<readonly unknown[]>,
    vault.getAccount(idValue) as Promise<readonly unknown[]>,
    market.auditMandate(idValue) as Promise<readonly unknown[]>,
  ]);
  const statuses = [
    "Funding",
    "Open",
    "Paused",
    "Cancelled",
    "Expired",
    "Filled",
    "Closed",
  ];
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

async function inspectReservation(
  idValue: bigint,
  market: Contract,
  vault: Contract,
  output: ProtocolOutput,
): Promise<void> {
  if (idValue <= 0n)
    throw new ProtocolCommandError(
      "Validating reservation ID",
      "Reservation ID must be a positive integer.",
      "Pass --reservation with a canonical on-chain ID.",
    );
  let reservation: readonly unknown[];
  try {
    reservation = (await market.getReservation(idValue)) as readonly unknown[];
  } catch (error) {
    if (contractErrorName(error, market) === "ReservationNotFound") {
      throw new ProtocolCommandError(
        "Reading reservation",
        "We couldn't find that reservation.",
        "Check the canonical reservation ID and the selected deployment addresses.",
      );
    }
    throw error;
  }
  const mandateId = reservation[1] as bigint;
  const [requirements, mandate, account, escrow] = await Promise.all([
    market.getReservationRequirements(idValue) as Promise<readonly unknown[]>,
    market.getMandate(mandateId) as Promise<readonly unknown[]>,
    vault.getAccount(mandateId) as Promise<readonly unknown[]>,
    vault.getBondEscrow(idValue) as Promise<readonly unknown[]>,
  ]);
  const token = requirements[2] as string;
  const solvent = (await vault.isSolvent(token)) as boolean;
  const marketConfig = requirements[0] as readonly unknown[];
  const statuses = ["Active", "Expired", "Settled"];
  const target = mandate[4] as bigint;
  const acquired = mandate[5] as bigint;
  const reserved = mandate[6] as bigint;
  const funded = account[1] as bigint;
  const spent = account[2] as bigint;
  const reservedBudget = account[3] as bigint;
  const free = account[4] as bigint;
  const refunded = account[5] as bigint;

  output.phase(`Reservation ${idValue}`, statuses[Number(reservation[11])]);
  output.phase("Acquisition Mandate", mandateId.toString());
  output.phase("Source market", (mandate[2] as bigint).toString());
  output.phase("Quantity", `${reservation[3]} delivery-token base units`);
  output.phase(
    "Locked payout",
    `${reservation[4]} settlement-token base units`,
  );
  output.phase("Bond", `${reservation[5]} settlement-token base units`);
  output.phase("Solver", reservation[2] as string);
  output.phase("Recipient", requirements[1] as string);
  output.phase("Source chain key", (marketConfig[0] as bigint).toString());
  output.phase("Foreign token", marketConfig[1] as string);
  output.phase(
    "Foreign token decimals",
    (marketConfig[2] as bigint).toString(),
  );
  output.phase("Settlement token", token);
  output.phase(
    "Settlement token decimals",
    (marketConfig[4] as bigint).toString(),
  );
  output.phase("Created at", formatTimestamp(reservation[6] as bigint));
  output.phase("Delivery deadline", formatTimestamp(reservation[7] as bigint));
  output.phase("Accepted source start", `${reservation[8]} (inclusive)`);
  output.phase("Accepted source end", `${reservation[9]} (inclusive)`);
  output.phase(
    "Expiry eligible height",
    (reservation[10] as bigint).toString(),
  );
  output.phase(
    "Available quantity",
    `${target - acquired - reserved} delivery-token base units`,
  );
  output.phase("Reserved quantity", `${reserved} delivery-token base units`);
  output.phase("Acquired quantity", `${acquired} delivery-token base units`);
  output.phase("Funded", `${funded} settlement-token base units`);
  output.phase("Free budget", `${free} settlement-token base units`);
  output.phase(
    "Reserved budget",
    `${reservedBudget} settlement-token base units`,
  );
  output.phase("Spent budget", `${spent} settlement-token base units`);
  output.phase("Refunded", `${refunded} settlement-token base units`);
  output.phase(
    "Bond escrow",
    escrow[3]
      ? "resolved"
      : `${escrow[2]} settlement-token base units unresolved`,
  );
  output.phase(
    "Quantity reconciliation",
    acquired + reserved <= target ? "pass" : "fail",
  );
  output.phase(
    "Budget reconciliation",
    funded === spent + reservedBudget + free + refunded ? "pass" : "fail",
  );
  const expectedBondResolved = Number(reservation[11]) !== 0;
  const bondReconciles =
    getAddress(escrow[0] as string) === getAddress(token) &&
    getAddress(escrow[1] as string) === getAddress(reservation[2] as string) &&
    escrow[2] === reservation[5] &&
    escrow[3] === expectedBondResolved;
  output.phase("Bond reconciliation", bondReconciles ? "pass" : "fail");
  output.phase("Vault token solvency", solvent ? "pass" : "fail");
}

function formatTimestamp(timestamp: bigint): string {
  const maxDateSeconds = 8_640_000_000_000n;
  if (timestamp > maxDateSeconds) return timestamp.toString();
  return `${timestamp} (${new Date(Number(timestamp) * 1000).toISOString()})`;
}

function contractErrorName(
  error: unknown,
  contract: Contract,
): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { data?: unknown; revert?: { name?: unknown } };
  if (typeof candidate.revert?.name === "string") return candidate.revert.name;
  if (typeof candidate.data !== "string") return undefined;
  try {
    return contract.interface.parseError(candidate.data)?.name;
  } catch {
    return undefined;
  }
}

async function resolveDeployment(
  values: Record<string, string>,
): Promise<ProtocolDeploymentArtifact> {
  const suppliedAddresses = [
    values.registry,
    values.market,
    values.vault,
    values.settlement,
    values.admin,
  ].filter(Boolean).length;
  if (suppliedAddresses > 0 && suppliedAddresses < 5) {
    throw new ProtocolCommandError(
      "Loading deployment addresses",
      "Direct inspection requires registry, market, vault, settlement, and admin together.",
      "Pass all five public values or omit them to use the canonical artifact.",
    );
  }
  if (
    values.registry &&
    values.market &&
    values.vault &&
    values.settlement &&
    values.admin
  ) {
    return {
      schemaVersion: "3",
      environmentConfigVersion: config.configVersion,
      environmentConfigHash: id(config.configVersion),
      chainId: config.creditcoin.chainId,
      deployedAt: "address-input",
      compiler: {
        version: "0.8.30",
        optimizer: true,
        optimizerRuns: 200,
        viaIr: true,
        evmVersion: "shanghai",
      },
      protocolAdmin: getAddress(values.admin),
      deployer: "0x0000000000000000000000000000000000000000",
      contracts: {
        registry: getAddress(values.registry),
        market: getAddress(values.market),
        vault: getAddress(values.vault),
        settlement: getAddress(values.settlement),
        verifier: config.attestcoin.verifierAddress,
        chainInfo: config.attestcoin.chainInfoAddress,
        decoder: config.attestcoin.decoderAddress,
      },
      marketId: "1",
      deploymentBlock: "0",
      bondPolicy: { rateBps: "", cap: "", denominator: "10000" },
      sourceWindowPolicy: {
        acceptedBlocks: "",
        settlementGraceBlocks: "",
        bounds: "inclusive",
      },
      transactions: {
        registryDeployment: "",
        marketDeployment: "",
        vaultDeployment: "",
        settlementDeployment: "",
        vaultConfiguration: "",
        settlementConfiguration: "",
        marketConfiguration: "",
      },
    };
  }
  try {
    return JSON.parse(
      await readFile(
        path.join(projectRoot, "artifacts", "protocol", "cc3-settlement.json"),
        "utf8",
      ),
    ) as ProtocolDeploymentArtifact;
  } catch {
    throw new ProtocolCommandError(
      "Loading deployment addresses",
      "No canonical CC3 deployment artifact exists.",
      "Pass --registry, --market, --vault, and --admin to inspect live addresses directly.",
    );
  }
}

function mismatch(message: string): ProtocolCommandError {
  return new ProtocolCommandError(
    "Verifying live deployment",
    message,
    "Do not use this deployment for mandate funding. Reconcile the live reads and recorded addresses.",
  );
}
