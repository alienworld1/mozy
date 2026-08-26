import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Contract, JsonRpcProvider, Wallet, getAddress, isHexString } from "ethers";
import { attestcoinEnvironment as config } from "../../config/attestcoin-environment.js";
import { projectRoot } from "../attestcoin/paths.js";
import type { StoredProof } from "../attestcoin/types.js";
import { loadContractArtifact } from "./artifacts.js";
import type { ProtocolDeploymentArtifact } from "./deployment-artifact.js";
import { ProtocolCommandError } from "./errors.js";
import type { ProtocolOutput } from "./output.js";

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim() ?? "";
  if (!value) throw new ProtocolCommandError("Checking settlement inputs", `${name} is not configured.`, "Set the disposable testnet value in .env before retrying.");
  return value;
}

export async function settleReservation(values: Record<string, string>, output: ProtocolOutput): Promise<void> {
  if (!values.reservation || !/^\d+$/.test(values.reservation) || BigInt(values.reservation) <= 0n) {
    throw new ProtocolCommandError("Validating settlement inputs", "Reservation ID must be a positive integer.", "Pass --reservation with the canonical on-chain ID.");
  }
  if (!values.proof) throw new ProtocolCommandError("Validating settlement inputs", "A saved proof artifact is required.", "Pass --proof with the existing ignored proof JSON path.");

  const [deployment, proof, settlementArtifact, marketArtifact] = await Promise.all([
    readJson<ProtocolDeploymentArtifact>(path.join(projectRoot, "artifacts", "protocol", "cc3-settlement.json")),
    readJson<StoredProof>(path.resolve(projectRoot, values.proof)),
    loadContractArtifact("MozySettlement"),
    loadContractArtifact("MozyMarket"),
  ]);
  validateProof(proof);
  if (deployment.schemaVersion !== "3" || deployment.chainId !== config.creditcoin.chainId) {
    throw new ProtocolCommandError("Checking deployment", "The canonical settlement deployment artifact is incompatible.", "Reconcile the fresh CC3 deployment before submitting a proof.");
  }

  const provider = new JsonRpcProvider(requiredEnvironment(config.creditcoin.rpcEnv));
  if ((await provider.getNetwork()).chainId !== BigInt(config.creditcoin.chainId)) {
    throw new ProtocolCommandError("Checking Creditcoin", "The configured RPC is not connected to CC3.", "Use the pinned CC3 RPC URL.");
  }
  const relayer = new Wallet(requiredEnvironment("MOZY_RELAYER_PRIVATE_KEY"), provider);
  if (await provider.getBalance(relayer.address) === 0n) {
    throw new ProtocolCommandError("Checking relayer funding", "The settlement relayer has no tCTC.", "Fund the disposable relayer address and retry the same proof.");
  }

  const settlement = new Contract(deployment.contracts.settlement, settlementArtifact.abi, relayer);
  const market = new Contract(deployment.contracts.market, marketArtifact.abi, provider);
  const reservationId = BigInt(values.reservation);
  const [reservation, requirements] = await Promise.all([
    market.getReservation(reservationId) as Promise<readonly unknown[]>,
    market.getReservationRequirements(reservationId) as Promise<readonly unknown[]>,
  ]);
  const sourceWindowStart = reservation[8] as bigint;
  const sourceWindowEnd = reservation[9] as bigint;
  if (Number(reservation[11]) !== 0) {
    throw new ProtocolCommandError("Reading reservation", "This reservation can no longer be settled.", "Inspect its canonical terminal state; do not resubmit the proof.");
  }
  if (BigInt(proof.chainKey) !== BigInt(config.foreign.sourceChainKey) || BigInt(proof.headerNumber) < sourceWindowStart || BigInt(proof.headerNumber) > sourceWindowEnd) {
    throw new ProtocolCommandError("Checking authenticated source window", "The saved proof height is outside this reservation's accepted source window.", "Use a qualifying transfer mined within the displayed source-height bounds.");
  }

  output.phase("Reading reservation", `${reservationId}: accepted source heights ${sourceWindowStart}-${sourceWindowEnd}`);
  output.phase("Expected solver", reservation[2] as string);
  output.phase("Expected recipient", requirements[1] as string);
  output.phase("Credited amount", `${reservation[3]} delivery-token base units`);
  output.phase("Locked payout", `${reservation[4]} settlement-token base units`);
  output.phase("Verifying Attestcoin proof", `${proof.sourceTxHash} at source height ${proof.headerNumber}`);

  const proofArguments = [
    reservationId,
    proof.chainKey,
    proof.headerNumber,
    proof.txBytes,
    [proof.merkleProof.root, proof.merkleProof.siblings.map((entry) => [entry.hash, entry.isLeft])],
    [proof.continuityProof.lowerEndpointDigest, proof.continuityProof.roots],
  ] as const;
  const replayIdentity = await settlement.settle.staticCall(...proofArguments) as string;
  output.phase("Proof simulation", `pass; replay identity ${replayIdentity}`);
  output.phase("Submitting settlement", relayer.address);
  const transaction = await settlement.settle(...proofArguments);
  output.transaction("Settlement submitted", transaction.hash, config.creditcoin.explorerUrl);
  const receipt = await transaction.wait();
  if (!receipt || receipt.status !== 1) throw new ProtocolCommandError("Waiting for Creditcoin confirmation", "The settlement transaction did not succeed.", "Inspect the submitted transaction hash before taking another action.");
  const event = receipt.logs
    .map((log: { topics: readonly string[]; data: string }) => {
      try { return settlement.interface.parseLog({ topics: log.topics, data: log.data }); } catch { return null; }
    })
    .find((parsed: { name?: string } | null) => parsed?.name === "ReservationSettled");
  if (!event) throw new ProtocolCommandError("Confirming settlement event", "The successful transaction did not expose ReservationSettled.", "Inspect the submitted transaction and deployed ABI before proceeding.");

  const finalReservation = await market.getReservation(reservationId) as readonly unknown[];
  if (Number(finalReservation[11]) !== 2) throw new ProtocolCommandError("Confirming settlement", "The reservation did not reach its canonical settled state.", "Inspect the transaction and live protocol wiring before retrying.");
  const marketConfig = requirements[0] as readonly unknown[];
  const evidence = {
    schemaVersion: "1",
    verifiedAt: new Date().toISOString(),
    deploymentArtifact: "artifacts/protocol/cc3-settlement.json",
    chainId: config.creditcoin.chainId,
    contracts: deployment.contracts,
    reservationId: reservationId.toString(),
    foreignTransaction: proof.sourceTxHash,
    foreignBlockHeight: proof.headerNumber.toString(),
    transactionIndex: proof.txIndex.toString(),
    transferLogIndex: event.args.transferLogIndex.toString(),
    settlementTransaction: transaction.hash,
    replayIdentity,
    relayer: relayer.address,
    solver: getAddress(reservation[2] as string),
    recipient: getAddress(requirements[1] as string),
    deliveredToken: getAddress(marketConfig[1] as string),
    deliveredAmount: event.args.deliveredAmount.toString(),
    creditedAmount: (reservation[3] as bigint).toString(),
    lockedPayout: (reservation[4] as bigint).toString(),
    returnedBond: (reservation[5] as bigint).toString(),
    sourceWindow: { start: sourceWindowStart.toString(), end: sourceWindowEnd.toString(), bounds: "inclusive" },
    semanticChecks: {
      officialVerification: "pass", sourceChain: "pass", sourceTiming: "pass", directTransfer: "pass",
      token: "pass", sender: "pass", recipient: "pass", amount: "pass", replayProtection: "pass",
      reservationState: "settled",
    },
  };
  const evidencePath = path.join(projectRoot, "artifacts", "protocol", "cc3-settlement-evidence.json");
  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  output.phase("Delivery verified", `${reservation[3]} credited and ${reservation[4]} paid to ${reservation[2]}`);
  output.phase("Evidence artifact", "artifacts/protocol/cc3-settlement-evidence.json");
}

async function readJson<T>(file: string): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (error) {
    throw new ProtocolCommandError("Reading settlement input", `Could not read ${file}: ${error instanceof Error ? error.message : String(error)}.`, "Use an existing deployment and saved proof artifact.");
  }
}

function validateProof(proof: StoredProof): void {
  if (
    proof.schemaVersion !== "1" || !Number.isSafeInteger(proof.chainKey) || !Number.isSafeInteger(proof.headerNumber)
    || !Number.isSafeInteger(proof.txIndex) || !isHexString(proof.sourceTxHash, 32) || !isHexString(proof.txBytes)
    || proof.txBytes === "0x" || !isHexString(proof.merkleProof?.root, 32)
    || !isHexString(proof.continuityProof?.lowerEndpointDigest, 32)
  ) throw new ProtocolCommandError("Validating settlement proof", "The saved proof artifact has an invalid shape.", "Regenerate it through the pinned Attestcoin proof command.");
  for (const sibling of proof.merkleProof.siblings) if (!isHexString(sibling.hash, 32)) throw invalidProof();
  for (const root of proof.continuityProof.roots) if (!isHexString(root, 32)) throw invalidProof();
}

function invalidProof(): ProtocolCommandError {
  return new ProtocolCommandError("Validating settlement proof", "The saved proof artifact contains an invalid proof element.", "Regenerate it through the pinned Attestcoin proof command.");
}
