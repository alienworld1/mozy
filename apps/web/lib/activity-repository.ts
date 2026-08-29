import "server-only";

import { releaseConfig } from "@mozy/chain-config";
import {
  foreignTransactions,
  getDatabase,
  proofJobs,
  protocolEvents,
  reservations,
  safePhase,
  syncCursors,
} from "@mozy/db";
import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import { formatUnits, isAddress, isHash } from "viem";
import { z } from "zod";
import type { ActivityItem, ActivityResponse } from "@/features/activity/types";

const protocolTitles = {
  MandateCreated: "Acquisition created",
  MandateFunded: "Acquisition funded",
  MandateOpened: "Acquisition opened",
  MandatePaused: "Acquisition paused",
  MandateResumed: "Acquisition resumed",
  MandateCancelled: "Open remainder cancelled",
  MandateExpired: "Acquisition expired",
  BuyerRefunded: "Funds reclaimed",
  MandateClosed: "Acquisition closed",
  ReservationCreated: "Fill reserved",
  ReservationExpired: "Reservation expired",
  ReservationBondForfeited: "Reservation bond forfeited",
  ReservationSettled: "Delivery verified and payment released",
} as const;

type PublicProtocolEvent = keyof typeof protocolTitles;
type RankedActivity = ActivityItem & { rank: number };

const cursorSchema = z.object({
  v: z.literal(1),
  occurredAt: z.string().datetime(),
  rank: z.number().int().min(1).max(3),
  id: z.string().min(1).max(160),
});

export class InvalidActivityCursorError extends Error {}

function decodeCursor(cursor?: string | null) {
  if (!cursor) return undefined;
  try {
    return cursorSchema.parse(
      JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
    );
  } catch {
    throw new InvalidActivityCursorError("invalid_cursor");
  }
}

function encodeCursor(item: RankedActivity) {
  return Buffer.from(
    JSON.stringify({
      v: 1,
      occurredAt: item.occurredAt,
      rank: item.rank,
      id: item.id,
    }),
  ).toString("base64url");
}

function isBefore(item: RankedActivity, cursor: z.infer<typeof cursorSchema>) {
  const time = item.occurredAt.localeCompare(cursor.occurredAt);
  if (time !== 0) return time < 0;
  if (item.rank !== cursor.rank) return item.rank < cursor.rank;
  return item.id < cursor.id;
}

function destination(mandateId: string | null, reservationId: string | null, settled = false) {
  if (reservationId)
    return settled
      ? { href: `/activity/receipts/${reservationId}`, label: "View receipt" }
      : {
          href: `/solver/reservations/${reservationId}`,
          label: "View reservation",
        };
  return {
    href: `/acquisitions/${mandateId}`,
    label: "View acquisition",
  };
}

function amountDetail(payload: Record<string, unknown>, eventName: string) {
  const raw =
    eventName === "ReservationSettled"
      ? payload.lockedPayout
      : eventName === "ReservationCreated"
        ? payload.quantity
        : null;
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return null;
  const token =
    eventName === "ReservationCreated"
      ? releaseConfig.deliveryToken
      : releaseConfig.settlementToken;
  return `${formatUnits(BigInt(raw), token.decimals)} ${token.symbol}`;
}

function safeActor(payload: Record<string, unknown>) {
  for (const key of ["solver", "buyer", "relayer", "caller"]) {
    const value = payload[key];
    if (typeof value === "string" && isAddress(value)) return value.toLowerCase();
  }
  return null;
}

export async function getActivityPage({
  cursor: cursorValue,
  limit,
}: {
  cursor?: string | null;
  limit: number;
}): Promise<ActivityResponse> {
  const cursor = decodeCursor(cursorValue);
  const before = cursor ? new Date(cursor.occurredAt) : undefined;
  const db = getDatabase();
  const addresses = [
    releaseConfig.contracts.market.toLowerCase(),
    releaseConfig.contracts.registry.toLowerCase(),
    releaseConfig.contracts.settlement.toLowerCase(),
  ];
  const [events, candidates, jobs, indexer] = await Promise.all([
    db
      .select()
      .from(protocolEvents)
      .where(
        and(
          eq(protocolEvents.chainId, BigInt(releaseConfig.creditcoin.id)),
          inArray(protocolEvents.contractAddress, addresses),
          inArray(protocolEvents.eventName, Object.keys(protocolTitles)),
          isNull(protocolEvents.orphanedAt),
          isNotNull(protocolEvents.occurredAt),
          before ? lte(protocolEvents.occurredAt, before) : undefined,
        ),
      )
      .orderBy(
        desc(protocolEvents.occurredAt),
        desc(protocolEvents.blockNumber),
        desc(protocolEvents.transactionIndex),
        desc(protocolEvents.logIndex),
      )
      .limit(200),
    db
      .select()
      .from(foreignTransactions)
      .where(
        and(
          eq(foreignTransactions.configVersion, releaseConfig.configVersion),
          before
            ? or(
                lte(foreignTransactions.registeredAt, before),
                lte(foreignTransactions.observedAt, before),
              )
            : undefined,
        ),
      )
      .orderBy(desc(foreignTransactions.registeredAt))
      .limit(200),
    db
      .select({ job: proofJobs, candidate: foreignTransactions, reservation: reservations })
      .from(proofJobs)
      .innerJoin(
        foreignTransactions,
        eq(proofJobs.foreignTransactionId, foreignTransactions.id),
      )
      .leftJoin(
        reservations,
        and(
          eq(reservations.configVersion, releaseConfig.configVersion),
          eq(reservations.reservationId, proofJobs.reservationId),
        ),
      )
      .where(
        and(
          eq(foreignTransactions.configVersion, releaseConfig.configVersion),
          before ? lte(proofJobs.updatedAt, before) : undefined,
        ),
      )
      .orderBy(desc(proofJobs.updatedAt))
      .limit(200),
    db.query.syncCursors.findFirst({
      where: and(
        eq(syncCursors.configVersion, releaseConfig.configVersion),
        eq(syncCursors.streamKey, "indexer"),
      ),
    }),
  ]);

  const settledIds = new Set(
    events
      .filter((event) => event.eventName === "ReservationSettled")
      .map((event) => event.reservationId)
      .filter((id): id is string => id !== null),
  );
  const items: RankedActivity[] = [];
  for (const event of events) {
    const eventName = event.eventName as PublicProtocolEvent;
    const occurredAt = event.occurredAt;
    if (!occurredAt || !(eventName in protocolTitles)) continue;
    const payload = event.payload as Record<string, unknown>;
    const settled = eventName === "ReservationSettled";
    items.push({
      id: `p:${event.blockNumber.toString().padStart(24, "0")}:${String(event.transactionIndex).padStart(8, "0")}:${String(event.logIndex).padStart(8, "0")}`,
      rank: 3,
      kind: "protocol_event",
      type: eventName,
      occurredAt: occurredAt.toISOString(),
      mandateId: event.mandateId,
      reservationId: event.reservationId,
      actor: safeActor(payload),
      title: protocolTitles[eventName],
      detail: amountDetail(payload, eventName),
      transactionHash: isHash(event.transactionHash) ? event.transactionHash : null,
      chain: "creditcoin",
      destination: destination(event.mandateId, event.reservationId, settled),
    });
  }
  for (const candidate of candidates) {
    const base = candidate.id.toString().padStart(24, "0");
    items.push({
      id: `d:${base}:registered`,
      rank: 2,
      kind: "delivery_observation",
      type: "delivery_submitted",
      occurredAt: candidate.registeredAt.toISOString(),
      mandateId: null,
      reservationId: candidate.reservationId,
      actor: candidate.solver,
      title: "Delivery submitted",
      detail: candidate.supersededAt ? "Replaced" : null,
      transactionHash: candidate.transactionHash,
      chain: "foreign",
      destination: destination(null, candidate.reservationId),
    });
    if (candidate.observedAt)
      items.push({
        id: `d:${base}:observed`,
        rank: 2,
        kind: "delivery_observation",
        type: "delivery_found",
        occurredAt: candidate.observedAt.toISOString(),
        mandateId: null,
        reservationId: candidate.reservationId,
        actor: candidate.solver,
        title: "Delivery found",
        detail: candidate.semanticStatus === "accepted" ? "Transfer matched" : null,
        transactionHash: candidate.transactionHash,
        chain: "foreign",
        destination: destination(null, candidate.reservationId),
      });
  }
  const workerTitles = {
    delivery_submitted: "Waiting for source confirmation",
    waiting_for_verification: "Waiting for verification",
    proof_ready: "Verification ready for settlement",
    settlement_submitted: "Settlement submitted",
    candidate_not_accepted: "Delivery not accepted",
  } as const;
  for (const { job, candidate, reservation } of jobs) {
    if (job.status === "CONFIRMED" || settledIds.has(job.reservationId)) continue;
    const effective =
      job.status === "RETRYABLE"
        ? (job.resumeStatus ?? "WAITING_ATTESTATION")
        : job.status;
    const phase = safePhase(effective);
    const type = job.status === "RETRYABLE" ? "verification_retry" : phase;
    const title =
      job.status === "RETRYABLE"
        ? "Verification will retry"
        : workerTitles[phase as keyof typeof workerTitles];
    if (!title) continue;
    items.push({
      id: `w:${job.id.toString().padStart(24, "0")}`,
      rank: 1,
      kind: "worker_state",
      type,
      occurredAt: job.updatedAt.toISOString(),
      mandateId: reservation?.mandateId ?? null,
      reservationId: job.reservationId,
      actor: candidate.solver,
      title,
      detail:
        job.status === "TERMINAL_REJECTED" ? job.lastErrorDetailSafe : null,
      transactionHash: candidate.transactionHash,
      chain: "operational",
      destination: destination(reservation?.mandateId ?? null, job.reservationId),
    });
  }
  items.sort((a, b) =>
    b.occurredAt.localeCompare(a.occurredAt) || b.rank - a.rank || b.id.localeCompare(a.id),
  );
  const filtered = cursor ? items.filter((item) => isBefore(item, cursor)) : items;
  const page = filtered.slice(0, limit + 1);
  const visible = page.slice(0, limit);
  const last = visible.at(-1);
  return {
    items: visible.map(({ rank, ...item }) => {
      void rank;
      return item;
    }),
    nextCursor: page.length > limit && last ? encodeCursor(last) : null,
    freshness:
      indexer && Date.now() - indexer.heartbeatAt.getTime() <= 120_000
        ? "fresh"
        : "degraded",
  };
}
