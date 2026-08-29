export type ExpiryReadiness =
  | "not_due"
  | "waiting_source_closure"
  | "eligible"
  | "resolved"
  | "unavailable";

export function getExpiryReadiness({
  status,
  chainTimestamp,
  deliveryDeadline,
  latestAttestedHeight,
  expiryEligibleHeight,
}: {
  status: number;
  chainTimestamp: bigint;
  deliveryDeadline: bigint;
  latestAttestedHeight: bigint | null;
  expiryEligibleHeight: bigint;
}): ExpiryReadiness {
  if (status !== 0) return "resolved";
  if (chainTimestamp < deliveryDeadline) return "not_due";
  if (latestAttestedHeight === null) return "unavailable";
  if (latestAttestedHeight < expiryEligibleHeight)
    return "waiting_source_closure";
  return "eligible";
}
