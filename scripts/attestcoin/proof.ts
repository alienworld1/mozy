import { isHexString } from "ethers";
import { proofProvider } from "@gluwa/usc-sdk";
import { attestcoinEnvironment as config } from "../../config/attestcoin-environment.js";
import { AttestcoinError } from "./errors.js";
import { writeJson } from "./io.js";
import { proofRoot, transactionFile } from "./paths.js";
import { requireHex } from "./validation.js";
import type { StoredProof } from "./types.js";

export async function fetchAndStoreProof(input: {
  hash: `0x${string}`;
  blockNumber: number;
  proofBuilderUrl: string;
  attestedHeight: number;
}): Promise<StoredProof> {
  if (input.attestedHeight < input.blockNumber) {
    throw waiting(input.blockNumber, input.attestedHeight);
  }

  const builder = new proofProvider.service.ProofBuilder(config.foreign.sourceChainKey, input.proofBuilderUrl, 10_000);
  let lastError = "proof builder did not return a proof";
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await builder.getProof(input.hash);
    if (result.success && result.data) {
      const proof = validateProof(result.data, input.hash, input.blockNumber);
      await writeJson(transactionFile(proofRoot, input.hash), proof);
      return proof;
    }
    lastError = result.error ?? lastError;
    if (attempt < 2) await delay(backoffWithJitter(attempt));
  }

  if (/not found|attest|cache|height/i.test(lastError)) throw waiting(input.blockNumber, input.attestedHeight);
  throw new AttestcoinError(
    "Generating proof",
    "proof_service_error",
    `The official proof builder could not generate the proof after bounded retries: ${lastError}`,
    "Keep the same transaction hash and retry later. The source transfer will not be resent.",
    2,
  );
}

function validateProof(
  value: proofProvider.ContinuityResponse,
  hash: `0x${string}`,
  blockNumber: number,
): StoredProof {
  if (
    value.chainKey !== config.foreign.sourceChainKey ||
    value.headerNumber !== blockNumber ||
    value.txHash.toLowerCase() !== hash.toLowerCase() ||
    !Number.isSafeInteger(value.txIndex) ||
    value.txIndex < 0
  ) {
    throw invalidProof("chain key, block height, transaction hash, or transaction index");
  }
  if (!isHexString(value.txBytes) || value.txBytes === "0x") throw invalidProof("txBytes");
  requireHex(value.merkleProof.root, 32, "merkleProof.root");
  requireHex(value.continuityProof.lowerEndpointDigest, 32, "continuityProof.lowerEndpointDigest");
  for (const sibling of value.merkleProof.siblings) requireHex(sibling.hash, 32, "merkleProof.siblings[].hash");
  for (const root of value.continuityProof.roots) requireHex(root, 32, "continuityProof.roots[]");

  return {
    schemaVersion: "1",
    sourceTxHash: hash,
    chainKey: value.chainKey,
    headerNumber: value.headerNumber,
    txIndex: value.txIndex,
    txHash: value.txHash as `0x${string}`,
    txBytes: value.txBytes as `0x${string}`,
    merkleProof: {
      root: value.merkleProof.root as `0x${string}`,
      siblings: value.merkleProof.siblings.map((entry) => ({
        hash: entry.hash as `0x${string}`,
        isLeft: entry.isLeft,
      })),
    },
    continuityProof: {
      lowerEndpointDigest: value.continuityProof.lowerEndpointDigest as `0x${string}`,
      roots: value.continuityProof.roots as `0x${string}`[],
    },
    cached: Boolean(value.cached),
    generatedAt: new Date(value.generatedAt).toISOString(),
  };
}

function waiting(blockNumber: number, attestedHeight: number): AttestcoinError {
  return new AttestcoinError(
    "Waiting for source attestation",
    "waiting_for_attestation",
    `Source block is not attested yet. Retry proof generation later. Source block: ${blockNumber}; last observed attested height: ${attestedHeight}.`,
    "Keep the same transaction hash and rerun attestcoin:prove after the attested height advances.",
    2,
  );
}

function invalidProof(field: string): AttestcoinError {
  return new AttestcoinError(
    "Validating proof",
    "proof_validation_error",
    `Proof service returned data that does not match the source receipt: ${field}.`,
    "Do not submit this proof. Retry the official builder and reconcile the pinned SDK if it persists.",
  );
}

function backoffWithJitter(attempt: number): number {
  return 500 * 2 ** attempt + Math.floor(Math.random() * 251);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
