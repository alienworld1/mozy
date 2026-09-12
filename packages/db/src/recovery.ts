export const publicReasonClasses = [
  "source_transaction_failed",
  "indirect_token_call",
  "wrong_token",
  "wrong_sender",
  "wrong_recipient",
  "underdelivery",
  "ambiguous_or_nonstandard_transfer",
  "invalid_delivery_timing",
  "attestcoin_verification_failed",
  "reservation_no_longer_active",
  "receipt_already_consumed",
  "reservation_binding_mismatch",
  "candidate_not_accepted",
] as const;

export type PublicReasonClass = (typeof publicReasonClasses)[number];

export const publicReasonMessages: Record<PublicReasonClass, string> = {
  source_transaction_failed:
    "Delivery not accepted. The transaction did not succeed.",
  indirect_token_call:
    "Delivery not accepted. Smart-account or batched execution is not supported; send a direct ERC-20 transfer.",
  wrong_token:
    "Delivery not accepted. The transaction did not call the required token contract directly.",
  wrong_sender:
    "Delivery not accepted. The transfer was not sent by the reserved solver.",
  wrong_recipient: "Delivery not accepted. Wrong delivery wallet.",
  underdelivery:
    "Delivery not accepted. The transferred amount is below the reserved amount.",
  ambiguous_or_nonstandard_transfer:
    "Delivery not accepted. We couldn't identify one qualifying standard transfer.",
  invalid_delivery_timing:
    "Delivery not accepted. The transfer was outside this reservation's source-height window.",
  attestcoin_verification_failed:
    "Delivery could not be verified from the submitted transaction.",
  reservation_no_longer_active:
    "Delivery not accepted. This reservation is no longer Active.",
  receipt_already_consumed:
    "Delivery not accepted. This foreign transaction has already been used for settlement.",
  reservation_binding_mismatch:
    "Delivery not accepted. The verified receipt does not belong to this reservation.",
  candidate_not_accepted:
    "Delivery not accepted. We couldn't identify one qualifying standard transfer.",
};

export function classifyPublicReason(value: string): PublicReasonClass {
  if (/did not succeed|SourceReceiptUnsuccessful/i.test(value))
    return "source_transaction_failed";
  if (/indirect or delegated token execution|smart-account|batched execution/i.test(value))
    return "indirect_token_call";
  if (/approved token|token contract|WrongDeliveryToken|TransactionTargetMismatch/i.test(value))
    return "wrong_token";
  if (/sender|WrongDeliverySender/i.test(value)) return "wrong_sender";
  if (/recipient|WrongDeliveryRecipient/i.test(value)) return "wrong_recipient";
  if (/below|required delivery amount|Underdelivery/i.test(value))
    return "underdelivery";
  if (/height|window|timing|InvalidDeliveryTiming|source_height/i.test(value))
    return "invalid_delivery_timing";
  if (/ReceiptAlreadyConsumed|receipt_already_consumed/i.test(value))
    return "receipt_already_consumed";
  if (/reservation_environment_mismatch|binding/i.test(value))
    return "reservation_binding_mismatch";
  if (/reservation_inactive|ReservationExpired|IncompatibleReservationState/i.test(value))
    return "reservation_no_longer_active";
  if (/AttestcoinVerificationFailed|cryptographic|proof validation|proof_validation/i.test(value))
    return "attestcoin_verification_failed";
  if (/ambiguous|qualifying|standard ERC-20|TransferCallMismatch|AmbiguousTransfer/i.test(value))
    return "ambiguous_or_nonstandard_transfer";
  return "candidate_not_accepted";
}

export function publicReason(value: string) {
  const reasonClass = classifyPublicReason(value);
  return { reasonClass, message: publicReasonMessages[reasonClass] };
}

export type PublicNextAction =
  | "wait"
  | "automatic_retry"
  | "replace_candidate"
  | "inspect_settlement"
  | "release_expired"
  | "none";

export function candidateNextAction(
  canonicalStatus: "Active" | "Expired" | "Settled" | "Unknown",
  jobStatus?: string | null,
  resumeStatus?: string | null,
): PublicNextAction {
  if (canonicalStatus !== "Active") return "none";
  if (jobStatus === "TERMINAL_REJECTED") return "replace_candidate";
  if (
    jobStatus === "SUBMITTING" ||
    (jobStatus === "RETRYABLE" && resumeStatus === "SUBMITTING")
  )
    return "inspect_settlement";
  if (jobStatus === "RETRYABLE") return "automatic_retry";
  return "wait";
}
