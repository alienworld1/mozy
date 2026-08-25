import { AttestcoinError } from "../errors.js";
import type { CommandOutput } from "../output.js";
import { fetchAndStoreProof } from "../proof.js";
import { runPreflight } from "../preflight.js";
import { createForeignProvider } from "../providers.js";
import { requireTransactionHash } from "../validation.js";

export async function proveCommand(values: Record<string, string>, output: CommandOutput): Promise<unknown> {
  const hash = requireTransactionHash(values.tx);
  output.phase("Checking configuration");
  const { runtime, result: preflight } = await runPreflight();
  const provider = createForeignProvider(runtime.foreignRpcUrl);
  const transaction = await provider.getTransaction(hash);
  if (!transaction?.blockNumber) {
    output.phase("Waiting for source receipt", hash);
    throw new AttestcoinError(
      "Waiting for source receipt",
      "receipt_error",
      "The source transaction is not mined on the selected source chain.",
      "Keep the same hash and retry later. Do not resend the transfer.",
      2,
    );
  }

  output.phase("Waiting for source attestation", `source block ${transaction.blockNumber}`);
  output.phase("Generating proof");
  const proof = await fetchAndStoreProof({
    hash,
    blockNumber: transaction.blockNumber,
    proofBuilderUrl: runtime.proofBuilderUrl,
    attestedHeight: Number(preflight.sourceChain.proofBuilderAttestedHeight),
  });
  const result = {
    ok: true,
    proof: {
      sourceTxHash: proof.sourceTxHash,
      chainKey: proof.chainKey,
      headerNumber: proof.headerNumber,
      transactionIndex: proof.txIndex,
      generatedAt: proof.generatedAt,
      cached: proof.cached,
    },
    artifactPath: `.attestcoin/proofs/${hash.toLowerCase()}.json`,
    nextCommand: `pnpm attestcoin:verify --tx ${hash}`,
  };
  output.phase("Proof material saved", result.artifactPath);
  output.phase("Next command", result.nextCommand);
  return result;
}
