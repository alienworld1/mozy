import { getAddress, isAddress, isHexString } from "ethers";
import { AttestcoinError } from "./errors.js";

export function requireAddress(value: string | undefined, label: string): string {
  if (!value || !isAddress(value)) {
    throw new AttestcoinError(
      "Validating arguments",
      "validation_error",
      `${label} must be a valid EVM address.`,
      `Pass --${label.toLowerCase().replaceAll(" ", "-")} with a 20-byte address.`,
    );
  }
  return getAddress(value);
}

export function requireTransactionHash(value: string | undefined): `0x${string}` {
  if (!value || !isHexString(value, 32)) {
    throw new AttestcoinError(
      "Validating arguments",
      "validation_error",
      "Transaction hash must be exactly 32 bytes.",
      "Pass --tx with the full source transaction hash.",
    );
  }
  return value.toLowerCase() as `0x${string}`;
}

export function requirePositiveAmount(value: string | undefined): bigint {
  if (!value || !/^[0-9]+$/.test(value) || BigInt(value) <= 0n) {
    throw new AttestcoinError(
      "Validating arguments",
      "validation_error",
      "Amount must be a positive integer in token base units.",
      "Pass --amount without decimals, separators, or a sign.",
    );
  }
  return BigInt(value);
}

export function requireHex(value: unknown, bytes: number, field: string): asserts value is `0x${string}` {
  if (typeof value !== "string" || !isHexString(value, bytes)) {
    throw new AttestcoinError(
      "Validating proof",
      "proof_validation_error",
      `Proof service returned an invalid ${field}.`,
      "Do not submit this proof. Retry the official proof builder, then reconcile the pinned SDK if it persists.",
    );
  }
}
