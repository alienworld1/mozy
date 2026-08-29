import "server-only";
import { releaseConfig } from "@mozy/chain-config";
import {
  getDatabase,
  getHeartbeats,
  getVerification,
  candidateNextAction,
  publicReason,
  publicReasonClasses,
  safePhase,
} from "@mozy/db";
import { createPublicClient, http } from "viem";
import { NextResponse } from "next/server";
import { marketAbi } from "@/lib/acquisition-contracts";

export const runtime = "nodejs";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ reservationId: string }> },
) {
  const { reservationId } = await params;
  if (!/^[1-9]\d*$/.test(reservationId))
    return NextResponse.json(
      {
        ok: false,
        reason: "reservation_not_found",
        message: "We couldn’t find that reservation.",
      },
      { status: 400 },
    );
  try {
    const client = createPublicClient({
      chain: releaseConfig.creditcoin,
      transport: http(releaseConfig.creditcoin.rpcUrls.default.http[0]),
    });
    const reservation = await client.readContract({
      address: releaseConfig.contracts.market,
      abi: marketAbi,
      functionName: "getReservation",
      args: [BigInt(reservationId)],
    });
    const canonicalStatuses = ["Active", "Expired", "Settled"] as const;
    const canonicalStatus = canonicalStatuses[reservation.status] ?? "Unknown";
    const db = getDatabase();
    let rows: Awaited<ReturnType<typeof getVerification>> = [];
    let projectionFreshness: "fresh" | "refreshing" | "degraded" = "degraded";
    let verificationAvailability: "normal" | "delayed" | "unavailable" = "unavailable";
    try {
      const [verificationRows, heartbeats] = await Promise.all([
        getVerification(db, releaseConfig.configVersion, reservationId),
        getHeartbeats(db, releaseConfig.configVersion),
      ]);
      rows = verificationRows;
      const recent = heartbeats.filter(
        (heartbeat) => Date.now() - heartbeat.heartbeatAt.getTime() <= 120_000,
      );
      projectionFreshness = recent.length === 3 ? "fresh" : "refreshing";
      verificationAvailability = recent.some(
        (heartbeat) => heartbeat.streamKey === "worker",
      )
        ? "normal"
        : "delayed";
    } catch {
      // Canonical reservation state remains useful when projection enrichment is unavailable.
    }
    return NextResponse.json({
      ok: true,
      reservationId,
      canonicalReservationStatus: canonicalStatus,
      canonicalFreshness: "fresh",
      projectionFreshness,
      verificationAvailability,
      candidates: rows.map(({ candidate, job }) => ({
        id: candidate.id.toString(),
        transactionHash: candidate.transactionHash,
        source: candidate.source,
        registeredAt: candidate.registeredAt.toISOString(),
        observedAt: candidate.observedAt?.toISOString() ?? null,
        semanticStatus: candidate.semanticStatus,
        reasonClass:
          candidate.rejectionClass &&
          publicReasonClasses.includes(
            candidate.rejectionClass as (typeof publicReasonClasses)[number],
          )
            ? candidate.rejectionClass
            : candidate.semanticStatus === "rejected"
              ? publicReason(candidate.rejectionDetailSafe ?? "").reasonClass
              : null,
        reasonMessage:
          candidate.semanticStatus === "rejected"
            ? publicReason(candidate.rejectionDetailSafe ?? "").message
            : null,
        replacesCandidateId:
          candidate.replacesTransactionId?.toString() ?? null,
        phase: job
          ? safePhase(
              job.status === "CONFIRMED" && canonicalStatus !== "Settled"
                ? "RETRYABLE"
                : job.status === "RETRYABLE"
                  ? (job.resumeStatus ?? "WAITING_SOURCE_CONFIRMATION")
                  : job.status,
            )
          : "preparing_verification",
        affectedObject:
          job?.status === "RETRYABLE" ? "infrastructure" : "candidate",
        reservationUnchanged:
          canonicalStatus === "Active" && job?.status === "TERMINAL_REJECTED",
        nextAction: candidateNextAction(
          canonicalStatus,
          job?.status,
          job?.resumeStatus,
        ),
        statusMessage: job?.lastErrorDetailSafe ?? null,
        settlementTransactionHash: job?.creditcoinSettlementTxHash ?? null,
        updatedAt: (job?.updatedAt ?? candidate.updatedAt).toISOString(),
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        reason: "verification_unavailable",
        message:
          "We couldn't refresh verification. Your delivery and reservation are unchanged.",
      },
      { status: 503 },
    );
  }
}
