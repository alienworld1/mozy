import { Interface, getAddress } from "ethers";
import { blockProver } from "@gluwa/usc-sdk";
import { z } from "zod";
import { attestcoinEnvironment as config } from "../../../config/attestcoin-environment.js";
import { PROBE_ABI } from "../constants.js";
import { AttestcoinError } from "../errors.js";
import { loadRuntimeEnvironment, validatePublicConfiguration } from "../environment.js";
import { fileExists, readJson } from "../io.js";
import type { CommandOutput } from "../output.js";
import { evidencePath } from "../paths.js";
import { inspectReceipt } from "../receipt.js";
import { createCreditcoinProvider, createForeignProvider } from "../providers.js";
import { deriveReplayIdentity } from "../replay-identity.js";
import type { ReceiptEvidence, SemanticChecks, TransferExpectation } from "../types.js";

interface VerifiedEvidence {
  schemaVersion: "1";
  status: "verified";
  configVersion: string;
  foreignTxHash: `0x${string}`;
  creditcoinTxHash: `0x${string}`;
  foreignExplorerUrl: string;
  creditcoinExplorerUrl: string;
  transferExpectation: TransferExpectation;
  receipt: ReceiptEvidence;
  verification: {
    probeContractAddress: string;
    verifierAddress: string;
    verified: true;
    replayIdentity: `0x${string}`;
    semanticChecks: SemanticChecks;
  };
}

const semanticChecksSchema = z
  .object({
    sourceChain: z.literal("pass"),
    receiptSuccess: z.literal("pass"),
    transactionTarget: z.literal("pass"),
    token: z.literal("pass"),
    sender: z.literal("pass"),
    recipient: z.literal("pass"),
    amount: z.literal("pass"),
    sourceTiming: z.literal("pass"),
    replayIdentity: z.literal("pass"),
  })
  .strict();

const verifiedEvidenceSchema = z
  .object({
    schemaVersion: z.literal("1"),
    status: z.literal("verified"),
    configVersion: z.string().min(1),
    foreignTxHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
    creditcoinTxHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
    foreignExplorerUrl: z.string().url(),
    creditcoinExplorerUrl: z.string().url(),
    transferExpectation: z.object({
      sourceChainKey: z.number().int().nonnegative(),
      sourceChainId: z.number().int().positive(),
      token: z.string().min(1),
      sender: z.string().min(1),
      recipient: z.string().min(1),
      minimumAmount: z.string().regex(/^[1-9][0-9]*$/),
      transferTopic0: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
    }),
    receipt: z.object({
      foreignTxHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
      blockNumber: z.string().regex(/^[0-9]+$/),
      transactionIndex: z.string().regex(/^[0-9]+$/),
      transferAmount: z.string().regex(/^[0-9]+$/),
      replayIdentity: z.object({
        chainKey: z.string().regex(/^[0-9]+$/),
        blockHeight: z.string().regex(/^[0-9]+$/),
        transactionIndex: z.string().regex(/^[0-9]+$/),
        derived: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
      }),
    }).passthrough(),
    verification: z.object({
      probeContractAddress: z.string().min(1),
      verifierAddress: z.string().min(1),
      verified: z.literal(true),
      replayIdentity: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
      semanticChecks: semanticChecksSchema,
    }).passthrough(),
  })
  .passthrough();

const probeInterface = new Interface(PROBE_ABI);

export async function evidenceCheckCommand(output: CommandOutput): Promise<unknown> {
  await validatePublicConfiguration();
  if (!(await fileExists(evidencePath))) throw noEvidence();
  const raw = await readJson<Record<string, unknown>>(evidencePath);
  if (raw.status !== "verified") throw noEvidence();
  const parsed = verifiedEvidenceSchema.safeParse(raw);
  if (!parsed.success) {
    throw evidenceError(
      `The committed evidence manifest failed schema validation: ${parsed.error.issues
        .map((issue) => issue.path.join("."))
        .join(", ")}.`,
    );
  }
  const evidence = raw as unknown as VerifiedEvidence;
  validateEvidence(evidence);

  const runtime = loadRuntimeEnvironment({ requireSigner: false, requireProbe: false });
  const foreignProvider = createForeignProvider(runtime.foreignRpcUrl);
  const creditcoinProvider = createCreditcoinProvider(runtime.creditcoinRpcUrl);
  const sdkProvider = creditcoinProvider as unknown as ConstructorParameters<
    typeof blockProver.PrecompileBlockProver
  >[0];
  const prover = new blockProver.PrecompileBlockProver(sdkProvider, config.attestcoin.verifierAddress);
  output.phase("Checking recorded source receipt", evidence.foreignTxHash);
  const [receipt, creditcoinReceipt, probeCode, emptyProofIndex] = await Promise.all([
    inspectReceipt(foreignProvider, evidence.foreignTxHash, evidence.transferExpectation, true),
    creditcoinProvider.getTransactionReceipt(evidence.creditcoinTxHash),
    creditcoinProvider.getCode(evidence.verification.probeContractAddress),
    prover.computeTransactionIndex({ root: `0x${"00".repeat(32)}`, siblings: [] }),
  ]);
  if (BigInt(emptyProofIndex) !== 0n) throw evidenceError("The pinned Block Prover interface did not respond as expected.");

  if (!creditcoinReceipt || creditcoinReceipt.status !== 1) {
    throw evidenceError("The recorded Creditcoin verification transaction is not confirmed successful.");
  }
  if (getAddress(creditcoinReceipt.to ?? "0x0000000000000000000000000000000000000000") !== getAddress(evidence.verification.probeContractAddress)) {
    throw evidenceError("The recorded Creditcoin transaction does not target the semantic probe.");
  }
  if (probeCode === "0x") throw evidenceError("The recorded semantic probe address has no deployed code.");
  const authenticatedEvent = creditcoinReceipt.logs
    .map((log) => {
      try {
        return probeInterface.parseLog({ topics: [...log.topics], data: log.data });
      } catch {
        return null;
      }
    })
    .find((event) => event?.name === "ReceiptSemanticsAuthenticated");
  if (!authenticatedEvent || authenticatedEvent.args.replayIdentity !== evidence.verification.replayIdentity) {
    throw evidenceError("The recorded Creditcoin receipt does not contain the expected authenticated semantics event.");
  }

  const replayFirst = deriveReplayIdentity(
    BigInt(receipt.replayIdentity.chainKey),
    BigInt(receipt.replayIdentity.blockHeight),
    BigInt(receipt.replayIdentity.transactionIndex),
  );
  const replaySecond = deriveReplayIdentity(
    BigInt(receipt.replayIdentity.chainKey),
    BigInt(receipt.replayIdentity.blockHeight),
    BigInt(receipt.replayIdentity.transactionIndex),
  );
  if (
    replayFirst !== replaySecond ||
    replayFirst !== evidence.verification.replayIdentity ||
    JSON.stringify(receipt) !== JSON.stringify(evidence.receipt)
  ) {
    throw evidenceError("The recorded receipt or replay identity does not match fresh chain data.");
  }

  const result = {
    ok: true,
    status: "verified",
    foreignTxHash: evidence.foreignTxHash,
    creditcoinTxHash: evidence.creditcoinTxHash,
    replayIdentity: replayFirst,
    semanticChecks: evidence.verification.semanticChecks,
  };
  output.phase("Evidence is consistent", `${evidence.foreignTxHash} / ${evidence.creditcoinTxHash}`);
  return result;
}

function validateEvidence(evidence: VerifiedEvidence): void {
  if (
    evidence.schemaVersion !== "1" ||
    evidence.configVersion !== config.configVersion ||
    evidence.verification.verified !== true ||
    !evidence.foreignExplorerUrl.endsWith(`/tx/${evidence.foreignTxHash}`) ||
    !evidence.creditcoinExplorerUrl.endsWith(`/tx/${evidence.creditcoinTxHash}`) ||
    getAddress(evidence.verification.verifierAddress) !== getAddress(config.attestcoin.verifierAddress) ||
    Object.values(evidence.verification.semanticChecks).length !== 9 ||
    Object.values(evidence.verification.semanticChecks).some((value) => value !== "pass")
  ) {
    throw evidenceError("The committed evidence manifest is incomplete or does not match the selected config.");
  }
}

function noEvidence(): AttestcoinError {
  return new AttestcoinError(
    "Reviewing evidence",
    "evidence_error",
    "No verified receipt evidence found.",
    "Run pnpm attestcoin:preflight, then complete the documented transfer, proof, and verification commands.",
    2,
  );
}

function evidenceError(message: string): AttestcoinError {
  return new AttestcoinError(
    "Reviewing evidence",
    "evidence_error",
    message,
    "Do not treat the receipt-proof gate as complete. Re-run the read-only checks and reconcile the real chain evidence.",
  );
}
