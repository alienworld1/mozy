import "server-only";
import { releaseConfig } from "@mozy/chain-config";
import { getDatabase, getVerification, safePhase } from "@mozy/db";
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
    const [reservation, rows] = await Promise.all([
      client.readContract({
        address: releaseConfig.contracts.market,
        abi: marketAbi,
        functionName: "getReservation",
        args: [BigInt(reservationId)],
      }),
      getVerification(
        getDatabase(),
        releaseConfig.configVersion,
        reservationId,
      ),
    ]);
    const canonicalStatus =
      ["Active", "Expired", "Settled"][reservation.status] ?? "Unknown";
    return NextResponse.json({
      ok: true,
      reservationId,
      canonicalReservationStatus: canonicalStatus,
      projectionFreshness: "fresh",
      candidates: rows.map(({ candidate, job }) => ({
        id: candidate.id.toString(),
        transactionHash: candidate.transactionHash,
        source: candidate.source,
        registeredAt: candidate.registeredAt.toISOString(),
        observedAt: candidate.observedAt?.toISOString() ?? null,
        semanticStatus: candidate.semanticStatus,
        rejectionClass: candidate.rejectionClass,
        rejectionMessage: candidate.rejectionDetailSafe,
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
        nextAction:
          !job ||
          [
            "DETECTED",
            "WAITING_SOURCE_CONFIRMATION",
            "WAITING_ATTESTATION",
            "PROOF_READY",
            "SUBMITTING",
          ].includes(job.status)
            ? "waiting"
            : job.status === "RETRYABLE"
              ? "automatic_retry"
              : "none",
        statusMessage: job?.lastErrorDetailSafe ?? null,
        settlementTransactionHash: job?.creditcoinSettlementTxHash ?? null,
        updatedAt: (job?.updatedAt ?? candidate.updatedAt).toISOString(),
      })),
    });
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
