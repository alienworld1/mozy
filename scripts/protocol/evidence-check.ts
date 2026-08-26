import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  Contract,
  Interface,
  JsonRpcProvider,
  getAddress,
  id,
  solidityPackedKeccak256,
} from "ethers";
import { attestcoinEnvironment as config } from "../../config/attestcoin-environment.js";
import { projectRoot } from "../attestcoin/paths.js";
import { loadContractArtifact } from "./artifacts.js";
import type { ProtocolDeploymentArtifact } from "./deployment-artifact.js";
import { ProtocolCommandError } from "./errors.js";
import type { ProtocolOutput } from "./output.js";

interface SettlementEvidence {
  schemaVersion: "1";
  chainId: number;
  contracts: ProtocolDeploymentArtifact["contracts"];
  reservationId: string;
  foreignTransaction: string;
  foreignBlockHeight: string;
  transactionIndex: string;
  transferLogIndex: string;
  settlementTransaction: string;
  replayIdentity: string;
  relayer: string;
  solver: string;
  recipient: string;
  deliveredToken: string;
  deliveredAmount: string;
  creditedAmount: string;
  lockedPayout: string;
  returnedBond: string;
  sourceWindow: { start: string; end: string; bounds: "inclusive" };
}

const transferInterface = new Interface([
  "function transfer(address recipient,uint256 amount)",
  "event Transfer(address indexed from,address indexed to,uint256 value)",
]);

export async function checkSettlementEvidence(output: ProtocolOutput): Promise<void> {
  const creditcoinRpc = process.env[config.creditcoin.rpcEnv]?.trim();
  const foreignRpc = process.env[config.foreign.rpcEnv]?.trim();
  if (!creditcoinRpc || !foreignRpc) throw new ProtocolCommandError("Checking evidence inputs", "Both configured RPC URLs are required.", "Set the public CC3 and Sepolia RPC URLs in .env.");
  const [deployment, evidence, marketArtifact, vaultArtifact, settlementArtifact] = await Promise.all([
    readJson<ProtocolDeploymentArtifact>("artifacts/protocol/cc3-settlement.json"),
    readJson<SettlementEvidence>("artifacts/protocol/cc3-settlement-evidence.json"),
    loadContractArtifact("MozyMarket"),
    loadContractArtifact("SettlementVault"),
    loadContractArtifact("MozySettlement"),
  ]);
  if (deployment.schemaVersion !== "3" || evidence.schemaVersion !== "1" || evidence.chainId !== config.creditcoin.chainId) fail("Artifact schemas or chain ID do not match the release deployment.");

  const cc3 = new JsonRpcProvider(creditcoinRpc);
  const source = new JsonRpcProvider(foreignRpc);
  const market = new Contract(deployment.contracts.market, marketArtifact.abi, cc3);
  const vault = new Contract(deployment.contracts.vault, vaultArtifact.abi, cc3);
  const settlement = new Contract(deployment.contracts.settlement, settlementArtifact.abi, cc3);
  output.phase("Checking source delivery", evidence.foreignTransaction);
  const [sourceTransaction, sourceReceipt, settlementTransaction, settlementReceipt] = await Promise.all([
    source.getTransaction(evidence.foreignTransaction),
    source.getTransactionReceipt(evidence.foreignTransaction),
    cc3.getTransaction(evidence.settlementTransaction),
    cc3.getTransactionReceipt(evidence.settlementTransaction),
  ]);
  if (!sourceTransaction || !sourceReceipt || sourceReceipt.status !== 1) fail("The recorded source transaction is missing or unsuccessful.");
  if (sourceReceipt.blockNumber.toString() !== evidence.foreignBlockHeight || sourceReceipt.index.toString() !== evidence.transactionIndex) fail("Source block height or transaction index differs from evidence.");
  if (getAddress(sourceTransaction.from) !== getAddress(evidence.solver) || !sourceTransaction.to || getAddress(sourceTransaction.to) !== getAddress(evidence.deliveredToken)) fail("The source sender or direct token target differs from evidence.");
  let decodedCall;
  try { decodedCall = transferInterface.decodeFunctionData("transfer", sourceTransaction.data); } catch { fail("The source transaction is not an exact standard transfer call."); }
  if (getAddress(decodedCall[0]) !== getAddress(evidence.recipient) || decodedCall[1].toString() !== evidence.deliveredAmount) fail("Source transfer calldata differs from evidence.");
  const sourceTransferLogs = sourceReceipt.logs.filter((log) =>
    getAddress(log.address) === getAddress(evidence.deliveredToken)
    && log.topics[0] === id("Transfer(address,address,uint256)"));
  if (sourceTransferLogs.length !== 1) fail("The source receipt does not contain exactly one token Transfer log.");
  const sourceTransfer = transferInterface.parseLog(sourceTransferLogs[0]);
  if (
    !sourceTransfer || getAddress(sourceTransfer.args.from) !== getAddress(evidence.solver)
    || getAddress(sourceTransfer.args.to) !== getAddress(evidence.recipient)
    || sourceTransfer.args.value.toString() !== evidence.deliveredAmount
  ) fail("The canonical source Transfer log differs from the direct call or evidence.");

  output.phase("Checking proof-to-payment transaction", evidence.settlementTransaction);
  if (!settlementTransaction || !settlementReceipt || settlementReceipt.status !== 1 || !settlementTransaction.to || getAddress(settlementTransaction.to) !== getAddress(deployment.contracts.settlement) || getAddress(settlementTransaction.from) !== getAddress(evidence.relayer)) fail("The recorded settlement transaction or relayer differs from evidence.");
  const event = settlementReceipt.logs
    .map((log) => { try { return settlement.interface.parseLog(log); } catch { return null; } })
    .find((parsed) => parsed?.name === "ReservationSettled");
  if (!event) fail("ReservationSettled is missing from the settlement receipt.");
  if (
    event.args.reservationId.toString() !== evidence.reservationId
    || event.args.replayIdentity.toLowerCase() !== evidence.replayIdentity.toLowerCase()
    || event.args.transferLogIndex.toString() !== evidence.transferLogIndex
    || event.args.deliveredAmount.toString() !== evidence.deliveredAmount
    || event.args.creditedAmount.toString() !== evidence.creditedAmount
    || event.args.lockedPayout.toString() !== evidence.lockedPayout
    || event.args.returnedBond.toString() !== evidence.returnedBond
    || getAddress(event.args.solver) !== getAddress(evidence.solver)
    || getAddress(event.args.recipient) !== getAddress(evidence.recipient)
    || getAddress(event.args.relayer) !== getAddress(evidence.relayer)
    || getAddress(event.args.token) !== getAddress(evidence.deliveredToken)
  ) fail("The canonical settlement event differs from recorded economics.");

  const expectedIdentity = solidityPackedKeccak256(
    ["uint256", "uint64", "uint256"],
    [BigInt(config.foreign.sourceChainKey), BigInt(evidence.foreignBlockHeight), BigInt(evidence.transactionIndex)],
  );
  if (expectedIdentity.toLowerCase() !== evidence.replayIdentity.toLowerCase()) fail("The replay identity does not follow the canonical derivation.");

  const reservationId = BigInt(evidence.reservationId);
  const [reservation, requirements, boundReservation] = await Promise.all([
    market.getReservation(reservationId) as Promise<readonly unknown[]>,
    market.getReservationRequirements(reservationId) as Promise<readonly unknown[]>,
    settlement.receiptReservation(evidence.replayIdentity) as Promise<bigint>,
  ]);
  const mandateId = reservation[1] as bigint;
  const [mandate, account, escrow] = await Promise.all([
    market.getMandate(mandateId) as Promise<readonly unknown[]>,
    vault.getAccount(mandateId) as Promise<readonly unknown[]>,
    vault.getBondEscrow(reservationId) as Promise<readonly unknown[]>,
  ]);
  if (
    Number(reservation[11]) !== 2 || boundReservation !== reservationId
    || (reservation[3] as bigint).toString() !== evidence.creditedAmount
    || (reservation[4] as bigint).toString() !== evidence.lockedPayout
    || (reservation[5] as bigint).toString() !== evidence.returnedBond
    || (reservation[8] as bigint).toString() !== evidence.sourceWindow.start
    || (reservation[9] as bigint).toString() !== evidence.sourceWindow.end
    || BigInt(evidence.foreignBlockHeight) < (reservation[8] as bigint)
    || BigInt(evidence.foreignBlockHeight) > (reservation[9] as bigint)
  ) fail("Canonical reservation state does not reconcile with the proof evidence.");
  const marketConfig = requirements[0] as readonly unknown[];
  if (
    getAddress(reservation[2] as string) !== getAddress(evidence.solver)
    || getAddress(requirements[1] as string) !== getAddress(evidence.recipient)
    || getAddress(marketConfig[1] as string) !== getAddress(evidence.deliveredToken)
    || mandate[5] !== reservation[3] || mandate[6] !== 0n
    || account[2] !== reservation[4] || account[3] !== 0n
    || escrow[3] !== true || !(await vault.isSolvent(requirements[2] as string) as boolean)
  ) fail("Quantity, payout, bond, or vault solvency does not reconcile.");

  const paymentLogs = settlementReceipt.logs
    .filter((log) => getAddress(log.address) === getAddress(requirements[2] as string) && log.topics[0] === id("Transfer(address,address,uint256)"))
    .map((log) => transferInterface.parseLog(log))
    .filter((log) => log && getAddress(log.args.from) === getAddress(deployment.contracts.vault) && getAddress(log.args.to) === getAddress(evidence.solver));
  const paid = paymentLogs.reduce((sum, log) => sum + (log?.args.value as bigint), 0n);
  if (paid !== BigInt(evidence.lockedPayout) + BigInt(evidence.returnedBond)) fail("Settlement-token transfers did not pay the solver the exact payout plus bond.");

  output.phase("Evidence", "verified across Sepolia and CC3");
  output.phase("Replay identity", evidence.replayIdentity);
  output.phase("Result", `${evidence.deliveredAmount} delivered; ${evidence.creditedAmount} credited; ${evidence.lockedPayout} paid`);
}

async function readJson<T>(relative: string): Promise<T> {
  try { return JSON.parse(await readFile(path.join(projectRoot, relative), "utf8")) as T; }
  catch { throw new ProtocolCommandError("Reading evidence", `Could not read ${relative}.`, "Preserve the canonical public deployment and settlement evidence artifacts."); }
}

function fail(message: string): never {
  throw new ProtocolCommandError("Validating settlement evidence", message, "Do not present this proof-to-payment run until the public chain data reconciles.");
}
