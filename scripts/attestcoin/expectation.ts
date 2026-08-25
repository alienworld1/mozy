import { attestcoinEnvironment as config } from "../../config/attestcoin-environment.js";
import { evidencePath, transactionFile, transferRoot } from "./paths.js";
import { fileExists, readJson } from "./io.js";
import { AttestcoinError } from "./errors.js";
import type { StoredTransfer, TransferExpectation } from "./types.js";

export async function loadExpectation(hash: `0x${string}`): Promise<TransferExpectation> {
  const localFile = transactionFile(transferRoot, hash);
  if (await fileExists(localFile)) return (await readJson<StoredTransfer>(localFile)).expectation;

  if (await fileExists(evidencePath)) {
    const evidence = await readJson<{ status?: string; foreignTxHash?: string; transferExpectation?: TransferExpectation }>(
      evidencePath,
    );
    if (
      evidence.status === "verified" &&
      evidence.foreignTxHash?.toLowerCase() === hash.toLowerCase() &&
      evidence.transferExpectation
    ) {
      return evidence.transferExpectation;
    }
  }

  throw new AttestcoinError(
    "Loading transfer expectation",
    "validation_error",
    `No recorded transfer expectation exists for ${hash}.`,
    `Use pnpm attestcoin:transfer first, or inspect the committed verified transaction from ${config.foreign.explorerUrl}.`,
  );
}
