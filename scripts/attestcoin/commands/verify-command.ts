import { Contract, Interface, Wallet, getAddress } from "ethers";
import { blockProver } from "@gluwa/usc-sdk";
import { attestcoinEnvironment as config } from "../../../config/attestcoin-environment.js";
import { PROBE_ABI } from "../constants.js";
import { AttestcoinError, errorMessage } from "../errors.js";
import { loadExpectation } from "../expectation.js";
import { readJson, writeJson } from "../io.js";
import type { CommandOutput } from "../output.js";
import { evidencePath, proofRoot, transactionFile } from "../paths.js";
import { runPreflight } from "../preflight.js";
import { createCreditcoinProvider, createForeignProvider } from "../providers.js";
import { inspectReceipt } from "../receipt.js";
import { deriveReplayIdentity } from "../replay-identity.js";
import type { SemanticChecks, StoredProof, TransferExpectation } from "../types.js";
import { requireAddress, requireTransactionHash } from "../validation.js";

const probeInterface = new Interface(PROBE_ABI);

export async function verifyCommand(values: Record<string, string>, output: CommandOutput): Promise<unknown> {
  const hash = requireTransactionHash(values.tx);
  output.phase("Checking configuration");
  const { runtime } = await runPreflight();
  const originalExpectation = await loadExpectation(hash);
  const expectedRecipient = values["expect-recipient"]
    ? requireAddress(values["expect-recipient"], "Expect recipient")
    : originalExpectation.recipient;
  const expectation: TransferExpectation = { ...originalExpectation, recipient: expectedRecipient };
  const isNegativeCheck = getAddress(expectedRecipient) !== getAddress(originalExpectation.recipient);

  let proof: StoredProof;
  try {
    proof = await readJson<StoredProof>(transactionFile(proofRoot, hash));
  } catch {
    throw new AttestcoinError(
      "Loading proof",
      "proof_validation_error",
      `No saved proof artifact exists for ${hash}.`,
      `Run pnpm attestcoin:prove --tx ${hash} first.`,
    );
  }

  const creditcoinProvider = createCreditcoinProvider(runtime.creditcoinRpcUrl);
  const foreignProvider = createForeignProvider(runtime.foreignRpcUrl);
  const sdkProvider = creditcoinProvider as unknown as ConstructorParameters<
    typeof blockProver.PrecompileBlockProver
  >[0];
  const prover = new blockProver.PrecompileBlockProver(sdkProvider, config.attestcoin.verifierAddress);
  output.phase("Submitting verification", "checking the official proof path before semantic submission");

  let cryptographicallyVerified: boolean;
  try {
    cryptographicallyVerified = await prover.verifySingle(
      proof.chainKey,
      proof.headerNumber,
      proof.txBytes,
      proof.merkleProof,
      proof.continuityProof,
    );
  } catch (error) {
    throw cryptographicError(error);
  }
  if (!cryptographicallyVerified) throw cryptographicError("verifier returned false");

  const [firstIndexRaw, secondIndexRaw, receipt] = await Promise.all([
    prover.computeTransactionIndex(proof.merkleProof),
    prover.computeTransactionIndex(proof.merkleProof),
    inspectReceipt(foreignProvider, hash, originalExpectation, true),
  ]);
  const firstIndex = BigInt(firstIndexRaw);
  const secondIndex = BigInt(secondIndexRaw);
  if (
    firstIndex !== secondIndex ||
    firstIndex !== BigInt(proof.txIndex) ||
    firstIndex !== BigInt(receipt.transactionIndex)
  ) {
    throw new AttestcoinError(
      "Comparing receipt semantics",
      "semantic_mismatch",
      "The official receipt identity could not be derived deterministically.",
      "Stop the gate and reconcile the proof builder, source receipt, and pinned v2 verifier behavior.",
    );
  }

  const replayIdentity = deriveReplayIdentity(
    BigInt(proof.chainKey),
    BigInt(proof.headerNumber),
    firstIndex,
  );
  if (replayIdentity !== receipt.replayIdentity.derived) {
    throw new AttestcoinError(
      "Comparing receipt semantics",
      "semantic_mismatch",
      "The official receipt identity could not be derived deterministically.",
      "Stop the gate and reconcile the documented v2 query identity encoding.",
    );
  }

  const wallet = new Wallet(runtime.privateKey, creditcoinProvider);
  const probe = new Contract(runtime.probeAddress, PROBE_ABI, wallet);
  const method = probe.getFunction("verifyReceipt");
  const callArguments = [
    proof.chainKey,
    proof.headerNumber,
    proof.txBytes,
    proof.merkleProof,
    proof.continuityProof,
    expectation.sourceChainKey,
    expectation.token,
    expectation.sender,
    expectation.recipient,
    BigInt(expectation.minimumAmount),
  ] as const;

  try {
    await method.staticCall(...callArguments);
  } catch (error) {
    throw semanticProbeError(error);
  }

  if (isNegativeCheck) {
    throw new AttestcoinError(
      "Comparing receipt semantics",
      "semantic_mismatch",
      "The negative recipient check unexpectedly passed.",
      "Do not write evidence; inspect the deployed probe address and ABI.",
    );
  }

  let submitted;
  try {
    const estimatedGas = await method.estimateGas(...callArguments);
    submitted = await method(...callArguments, { gasLimit: (estimatedGas * 135n) / 100n });
  } catch (error) {
    throw new AttestcoinError(
      "Submitting verification",
      "submission_error",
      `Creditcoin rejected the probe submission: ${errorMessage(error)}`,
      "Keep the saved proof and retry verification only; never resend the source transfer.",
    );
  }

  const creditcoinReceipt = await submitted.wait();
  if (!creditcoinReceipt || creditcoinReceipt.status !== 1) {
    throw new AttestcoinError(
      "Submitting verification",
      "submission_error",
      `Creditcoin verification transaction ${submitted.hash} was not confirmed successful.`,
      "Keep the saved proof and retry verification only after diagnosing the transaction.",
    );
  }

  const authenticatedEvent = creditcoinReceipt.logs
    .map((log: { topics: readonly string[]; data: string }) => {
      try {
        return probeInterface.parseLog({ topics: log.topics as string[], data: log.data });
      } catch {
        return null;
      }
    })
    .find((event: { name?: string } | null) => event?.name === "ReceiptSemanticsAuthenticated");
  if (!authenticatedEvent || authenticatedEvent.args.replayIdentity !== replayIdentity) {
    throw new AttestcoinError(
      "Comparing receipt semantics",
      "semantic_mismatch",
      "The Creditcoin probe did not emit the expected authenticated receipt identity.",
      "Do not write evidence; inspect the probe transaction and pinned decoder deployment.",
    );
  }

  const semanticChecks: SemanticChecks = {
    sourceChain: "pass",
    receiptSuccess: "pass",
    transactionTarget: "pass",
    token: "pass",
    sender: "pass",
    recipient: "pass",
    amount: "pass",
    sourceTiming: "pass",
    replayIdentity: "pass",
  };
  const verifiedAt = new Date().toISOString();
  const evidence = {
    schemaVersion: "1",
    status: "verified",
    configVersion: config.configVersion,
    verifiedAt,
    environment: { ...config, verifiedAt },
    foreignTxHash: hash,
    foreignExplorerUrl: `${config.foreign.explorerUrl}/tx/${hash}`,
    creditcoinTxHash: submitted.hash,
    creditcoinExplorerUrl: `${config.creditcoin.explorerUrl}/tx/${submitted.hash}`,
    transferExpectation: originalExpectation,
    receipt,
    verification: {
      creditcoinTxHash: submitted.hash,
      creditcoinBlockNumber: creditcoinReceipt.blockNumber.toString(),
      verifierAddress: config.attestcoin.verifierAddress,
      probeContractAddress: getAddress(runtime.probeAddress),
      verified: true,
      replayIdentity,
      authenticatedFields: receipt,
      semanticChecks,
      officialSourceRefs: config.officialSourceRefs,
    },
    proof: {
      chainKey: proof.chainKey,
      headerNumber: proof.headerNumber,
      txIndex: proof.txIndex,
      sourceTxHash: proof.sourceTxHash,
      generatedAt: proof.generatedAt,
    },
  };
  await writeJson(evidencePath, evidence);

  const result = {
    ok: true,
    message: "Receipt verified on Creditcoin",
    foreignTxHash: hash,
    creditcoinTxHash: submitted.hash,
    replayIdentity,
    semanticChecks,
    evidencePath: "artifacts/attestcoin/evidence.json",
  };
  output.phase("Receipt verified on Creditcoin", submitted.hash);
  output.phase("Replay identity", replayIdentity);
  output.phase("Evidence manifest", result.evidencePath);
  output.phase("Next command", "pnpm attestcoin:evidence:check");
  return result;
}

function cryptographicError(error: unknown): AttestcoinError {
  return new AttestcoinError(
    "Submitting verification",
    "cryptographic_verification_error",
    `Attestcoin could not verify this source receipt on Creditcoin: ${errorMessage(error)}`,
    "Preserve the proof and reconcile its chain, height, Merkle proof, and continuity proof before retrying.",
  );
}

function semanticProbeError(error: unknown): AttestcoinError {
  if (error && typeof error === "object") {
    const decoded = error as { revert?: { name?: string } };
    if (decoded.revert?.name) return semanticErrorByName(decoded.revert.name, error);
  }
  const data = extractRevertData(error);
  let name = "";
  if (data) {
    try {
      name = probeInterface.parseError(data)?.name ?? "";
    } catch {
      // Fall through to a generic semantic failure without exposing provider credentials.
    }
  }
  return semanticErrorByName(name, error);
}

function semanticErrorByName(name: string, error: unknown): AttestcoinError {
  const messages: Record<string, string> = {
    SourceChainMismatch: "Source chain does not match the selected Attestcoin chain key.",
    UnsuccessfulReceipt: "The source transaction was included but did not succeed.",
    TransactionTargetMismatch: "Delivery did not call the approved token contract directly.",
    TransactionSenderMismatch: "Source transaction sender does not match the expected solver address.",
    TransferCallMismatch: "Delivery did not call the approved token transfer function directly.",
    TransferSenderMismatch: "Transfer sender does not match the expected solver address.",
    TransferRecipientMismatch: "Transfer recipient does not match the expected delivery wallet.",
    TransferAmountBelowMinimum: "Transferred amount is below the required delivery amount.",
    AmbiguousTransfer: "Multiple qualifying Transfer logs make this delivery ambiguous.",
  };
  if (name === "CryptographicVerificationFailed") return cryptographicError(name);
  return new AttestcoinError(
    "Comparing receipt semantics",
    "semantic_mismatch",
    messages[name] ?? `The Creditcoin probe rejected authenticated receipt semantics: ${errorMessage(error)}`,
    "Do not create success evidence. Correct only the expectation if it was intentionally overridden.",
  );
}

function extractRevertData(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { data?: unknown; info?: { error?: { data?: unknown } } };
  if (typeof candidate.data === "string") return candidate.data;
  return typeof candidate.info?.error?.data === "string" ? candidate.info.error.data : undefined;
}
