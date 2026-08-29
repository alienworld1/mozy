import { AttestcoinError } from "../../../scripts/attestcoin/errors.js";
import { publicReason } from "@mozy/db";

export type JobError = {
  kind: "waiting_source" | "waiting_attestation" | "retryable" | "terminal";
  errorClass: string;
  safeDetail: string;
};

export function classifyJobError(error: unknown): JobError {
  if (error instanceof AttestcoinError) {
    if (error.errorClass === "waiting_for_attestation")
      return {
        kind: "waiting_attestation",
        errorClass: error.errorClass,
        safeDetail: "Delivery found. Waiting for verification.",
      };
    if (error.errorClass === "receipt_error" && error.exitCode === 2)
      return {
        kind: "waiting_source",
        errorClass: error.errorClass,
        safeDetail: "The delivery transaction is still being checked.",
      };
    if (error.errorClass === "proof_service_error" || error.exitCode === 2)
      return {
        kind: "retryable",
        errorClass: error.errorClass,
        safeDetail:
          "Delivery is unchanged. Verification will resume when proof infrastructure is available.",
      };
    if (
      error.errorClass === "proof_validation_error" ||
      error.errorClass === "cryptographic_verification_error"
    )
      return {
        kind: "terminal",
        errorClass: "attestcoin_verification_failed",
        safeDetail:
          "Delivery could not be verified from the submitted transaction.",
      };
    return {
      kind: "terminal",
      errorClass: publicReason(error.message).reasonClass,
      safeDetail: publicReason(error.message).message,
    };
  }
  const message = error instanceof Error ? error.message : "";
  if (
    /reservation_inactive|reservation_environment_mismatch|source_height_outside_window|source_height_unsupported|ReservationExpired|ReceiptAlreadyConsumed|WrongDelivery|Underdelivery|AmbiguousTransfer|SourceReceiptUnsuccessful|InvalidDeliveryTiming/i.test(
      message,
    )
  ) {
    return {
      kind: "terminal",
      errorClass: publicReason(message).reasonClass,
      safeDetail: publicReason(message).message,
    };
  }
  return {
    kind: "retryable",
    errorClass: "infrastructure_unavailable",
    safeDetail:
      "Delivery is unchanged. Verification will resume automatically.",
  };
}
