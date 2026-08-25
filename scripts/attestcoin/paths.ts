import { fileURLToPath } from "node:url";
import path from "node:path";

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const localStateRoot = path.join(projectRoot, ".attestcoin");
export const proofRoot = path.join(localStateRoot, "proofs");
export const transferRoot = path.join(localStateRoot, "transfers");
export const evidencePath = path.join(projectRoot, "artifacts/attestcoin/evidence.json");

export function transactionFile(root: string, hash: string): string {
  return path.join(root, `${hash.toLowerCase()}.json`);
}
