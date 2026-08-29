import type { ProofJobStatus } from "./schema";

const transitions: Record<ProofJobStatus, ReadonlySet<ProofJobStatus>> = {
  DETECTED: new Set([
    "WAITING_SOURCE_CONFIRMATION",
    "WAITING_ATTESTATION",
    "TERMINAL_REJECTED",
    "CONFIRMED",
  ]),
  WAITING_SOURCE_CONFIRMATION: new Set([
    "WAITING_SOURCE_CONFIRMATION",
    "WAITING_ATTESTATION",
    "RETRYABLE",
    "TERMINAL_REJECTED",
    "CONFIRMED",
  ]),
  WAITING_ATTESTATION: new Set([
    "WAITING_ATTESTATION",
    "PROOF_READY",
    "RETRYABLE",
    "TERMINAL_REJECTED",
    "CONFIRMED",
  ]),
  PROOF_READY: new Set([
    "SUBMITTING",
    "RETRYABLE",
    "TERMINAL_REJECTED",
    "CONFIRMED",
  ]),
  SUBMITTING: new Set(["CONFIRMED", "RETRYABLE", "TERMINAL_REJECTED"]),
  CONFIRMED: new Set(),
  RETRYABLE: new Set([
    "DETECTED",
    "WAITING_SOURCE_CONFIRMATION",
    "WAITING_ATTESTATION",
    "PROOF_READY",
    "SUBMITTING",
    "TERMINAL_REJECTED",
    "CONFIRMED",
  ]),
  TERMINAL_REJECTED: new Set(["CONFIRMED"]),
};

export function canTransition(from: ProofJobStatus, to: ProofJobStatus) {
  return transitions[from].has(to);
}

export function retryDelayMs(attempt: number, random = Math.random()) {
  const base = Math.min(15_000 * 2 ** Math.max(0, attempt), 900_000);
  return Math.min(
    base * (1 + Math.max(0, Math.min(0.2, random * 0.2))),
    900_000,
  );
}
