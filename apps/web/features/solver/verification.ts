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

const verificationCandidateSchema = z.object({
  id: z.string(),
  transactionHash: z.string().regex(/^0x[0-9a-f]{64}$/),
  source: z.enum(["composer", "external"]),
  registeredAt: z.string().datetime(),
  observedAt: z.string().datetime().nullable(),
  semanticStatus: z.enum(["pending", "accepted", "rejected"]),
  rejectionClass: z.string().nullable(),
  rejectionMessage: z.string().nullable(),
  replacesCandidateId: z.string().nullable(),
  phase: verificationPhaseSchema,
  nextAction: z.enum(["waiting", "automatic_retry", "none"]),
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
  projectionFreshness: z.enum(["fresh", "refreshing", "degraded"]),
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
