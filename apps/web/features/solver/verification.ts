import { z } from "zod";

export const verificationPhaseSchema = z.enum([
  "delivery_submitted",
  "waiting_for_verification",
  "proof_ready",
  "settlement_submitted",
  "payment_confirmed",
  "candidate_not_accepted",
  "preparing_verification",
]);
export type VerificationPhase = z.infer<typeof verificationPhaseSchema>;

export const publicReasonClassSchema = z.enum([
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
]);

const verificationCandidateSchema = z.object({
  id: z.string(),
  transactionHash: z.string().regex(/^0x[0-9a-f]{64}$/),
  source: z.enum(["composer", "external"]),
  registeredAt: z.string().datetime(),
  observedAt: z.string().datetime().nullable(),
  semanticStatus: z.enum(["pending", "accepted", "rejected"]),
  reasonClass: publicReasonClassSchema.nullable(),
  reasonMessage: z.string().nullable(),
  affectedObject: z.enum(["candidate", "reservation", "infrastructure"]),
  reservationUnchanged: z.boolean(),
  replacesCandidateId: z.string().nullable(),
  phase: verificationPhaseSchema,
  nextAction: z.enum([
    "wait",
    "automatic_retry",
    "replace_candidate",
    "inspect_settlement",
    "release_expired",
    "none",
  ]),
  settlementTransactionHash: z.string().nullable(),
  updatedAt: z.string().datetime(),
  statusMessage: z.string().nullable(),
});

export const verificationResponseSchema = z.object({
  ok: z.literal(true),
  reservationId: z.string(),
  canonicalReservationStatus: z.enum([
    "Active",
    "Expired",
    "Settled",
    "Unknown",
  ]),
  canonicalFreshness: z.enum(["fresh", "unavailable"]),
  projectionFreshness: z.enum(["fresh", "refreshing", "degraded"]),
  verificationAvailability: z.enum(["normal", "delayed", "unavailable"]),
  candidates: z.array(verificationCandidateSchema),
});
export type VerificationResponse = z.infer<typeof verificationResponseSchema>;
export type VerificationCandidate = VerificationResponse["candidates"][number];

export function needsCanonicalReservationRefresh(
  canonicalStatus: VerificationResponse["canonicalReservationStatus"] | undefined,
  workspaceStatus: number,
) {
  return canonicalStatus === "Settled" && workspaceStatus !== 2;
}

export function scheduleAnnotation(candidate?: VerificationCandidate) {
  if (!candidate) return "No transaction";
  if (candidate.phase === "candidate_not_accepted")
    return "Candidate not accepted";
  if (candidate.phase === "settlement_submitted") return "Settlement submitted";
  if (["waiting_for_verification", "proof_ready"].includes(candidate.phase))
    return "Waiting for verification";
  if (candidate.phase === "payment_confirmed") return "Payment confirmed";
  return "Submitted";
}
