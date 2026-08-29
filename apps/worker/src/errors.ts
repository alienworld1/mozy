import { AttestcoinError } from "../../../scripts/attestcoin/errors.js";

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
    return {
      kind: "terminal",
      errorClass: error.errorClass,
      safeDetail: safeSemanticMessage(error.message),
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
      errorClass: "canonical_incompatibility",
      safeDetail: safeSemanticMessage(message),
    };
  }
  return {
    kind: "retryable",
    errorClass: "infrastructure_unavailable",
    safeDetail:
      "Delivery is unchanged. Verification will resume automatically.",
  };
}

function safeSemanticMessage(message: string) {
  if (/did not succeed/i.test(message))
    return "Delivery not accepted. The transaction did not succeed.";
  if (/token contract|approved token/i.test(message))
    return "Delivery not accepted. Wrong token contract.";
  if (/sender/i.test(message))
    return "Delivery not accepted. The transfer was not sent by the reserved solver.";
  if (/recipient/i.test(message))
    return "Delivery not accepted. Wrong delivery wallet.";
  if (/below|required delivery amount/i.test(message))
    return "Delivery not accepted. The transferred amount is below the reserved amount.";
  if (/height|window|timing/i.test(message))
    return "Delivery not accepted. The transfer was outside this reservation's delivery window.";
  return "Delivery not accepted. We couldn't identify one qualifying standard transfer.";
}
