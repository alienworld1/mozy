export type ErrorClass =
  | "configuration_error"
  | "validation_error"
  | "funding_error"
  | "receipt_error"
  | "waiting_for_attestation"
  | "proof_service_error"
  | "proof_validation_error"
  | "cryptographic_verification_error"
  | "semantic_mismatch"
  | "submission_error"
  | "evidence_error";

export class AttestcoinError extends Error {
  constructor(
    public readonly phase: string,
    public readonly errorClass: ErrorClass,
    message: string,
    public readonly recovery: string,
    public readonly exitCode = 1,
  ) {
    super(message);
    this.name = "AttestcoinError";
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
