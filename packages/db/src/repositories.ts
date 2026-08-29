import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { getAddress } from "viem";
import type { Database } from "./client";
import {
  foreignTransactions,
  proofJobs,
  settlementReceipts,
  syncCursors,
  type ProofJobStatus,
} from "./schema";

export type SettlementReceiptProjection = typeof settlementReceipts.$inferInsert;

export type SettlementEventPayload = {
  reservationId: string;
  mandateId: string;
  replayIdentity: string;
  sourceChainKey: string;
  blockHeight: string;
  transactionIndex: string;
  transferLogIndex: string;
  token: string;
  solver: string;
  recipient: string;
  relayer: string;
  deliveredAmount: string;
  creditedAmount: string;
  lockedPayout: string;
  returnedBond: string;
};

export function buildSettlementReceiptProjection(input: {
  configVersion: string;
  event: {
    transactionHash: string;
    blockNumber: bigint;
    payload: SettlementEventPayload;
  };
  candidate: { id: bigint; transactionHash: string };
}): SettlementReceiptProjection {
  const { payload } = input.event;
  return {
    configVersion: input.configVersion,
    reservationId: payload.reservationId,
    mandateId: payload.mandateId,
    foreignTransactionId: input.candidate.id,
    foreignTxHash: input.candidate.transactionHash,
    sourceChainKey: BigInt(payload.sourceChainKey),
    blockHeight: BigInt(payload.blockHeight),
    transactionIndex: BigInt(payload.transactionIndex),
    transferLogIndex: BigInt(payload.transferLogIndex),
    replayIdentity: payload.replayIdentity.toLowerCase(),
    token: payload.token.toLowerCase(),
    solver: payload.solver.toLowerCase(),
    recipient: payload.recipient.toLowerCase(),
    relayer: payload.relayer.toLowerCase(),
    deliveredAmount: payload.deliveredAmount,
    creditedAmount: payload.creditedAmount,
    lockedPayout: payload.lockedPayout,
    returnedBond: payload.returnedBond,
    creditcoinSettlementTxHash: input.event.transactionHash.toLowerCase(),
    settlementBlockNumber: input.event.blockNumber,
  };
}

export async function upsertSettlementReceipt(
  db: Pick<Database, "insert">,
  receipt: SettlementReceiptProjection,
) {
  const now = new Date();
  const [row] = await db
    .insert(settlementReceipts)
    .values({ ...receipt, projectedAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [
        settlementReceipts.configVersion,
        settlementReceipts.reservationId,
      ],
      set: {
        mandateId: receipt.mandateId,
        foreignTransactionId: receipt.foreignTransactionId,
        foreignTxHash: receipt.foreignTxHash,
        sourceChainKey: receipt.sourceChainKey,
        blockHeight: receipt.blockHeight,
        transactionIndex: receipt.transactionIndex,
        transferLogIndex: receipt.transferLogIndex,
        replayIdentity: receipt.replayIdentity,
        token: receipt.token,
        solver: receipt.solver,
        recipient: receipt.recipient,
        relayer: receipt.relayer,
        deliveredAmount: receipt.deliveredAmount,
        creditedAmount: receipt.creditedAmount,
        lockedPayout: receipt.lockedPayout,
        returnedBond: receipt.returnedBond,
        creditcoinSettlementTxHash: receipt.creditcoinSettlementTxHash,
        settlementBlockNumber: receipt.settlementBlockNumber,
        updatedAt: now,
      },
    })
    .returning();
  return row;
}

export type DurableCandidateInput = {
  configVersion: string;
  reservationId: string;
  foreignChainId: bigint;
  sourceChainKey: bigint;
  transactionHash: `0x${string}`;
  solver: `0x${string}`;
  source: "composer" | "external";
  replacesHash?: `0x${string}`;
};

export async function registerCandidate(
  db: Database,
  input: DurableCandidateInput,
) {
  return db.transaction(async (tx) => {
    const hash = input.transactionHash.toLowerCase();
    const solver = getAddress(input.solver).toLowerCase();
    const existing = await tx.query.foreignTransactions.findFirst({
      where: and(
        eq(foreignTransactions.configVersion, input.configVersion),
        eq(foreignTransactions.reservationId, input.reservationId),
        eq(foreignTransactions.transactionHash, hash),
      ),
    });
    if (existing) {
      const [job] = await tx
        .insert(proofJobs)
        .values({
          foreignTransactionId: existing.id,
          reservationId: input.reservationId,
          foreignTxHash: hash,
          sourceChainKey: input.sourceChainKey,
        })
        .onConflictDoNothing()
        .returning();
      const currentJob =
        job ??
        (await tx.query.proofJobs.findFirst({
          where: eq(proofJobs.foreignTransactionId, existing.id),
        }));
      return { created: false, candidate: existing, job: currentJob! };
    }

    let replaced: typeof foreignTransactions.$inferSelect | undefined;
    if (input.replacesHash) {
      replaced = await tx.query.foreignTransactions.findFirst({
        where: and(
          eq(foreignTransactions.configVersion, input.configVersion),
          eq(foreignTransactions.reservationId, input.reservationId),
          eq(foreignTransactions.solver, solver),
          eq(
            foreignTransactions.transactionHash,
            input.replacesHash.toLowerCase(),
          ),
        ),
      });
      if (!replaced) throw new Error("replacement_not_found");
    }
    const registeredAt = new Date();
    await tx
      .update(foreignTransactions)
      .set({ supersededAt: registeredAt, updatedAt: registeredAt })
      .where(
        and(
          eq(foreignTransactions.configVersion, input.configVersion),
          eq(foreignTransactions.reservationId, input.reservationId),
          isNull(foreignTransactions.supersededAt),
        ),
      );
    const [candidate] = await tx
      .insert(foreignTransactions)
      .values({
        ...input,
        transactionHash: hash,
        solver,
        replacesTransactionId: replaced?.id,
        preferredAt: registeredAt,
        updatedAt: registeredAt,
      })
      .returning();
    const [job] = await tx
      .insert(proofJobs)
      .values({
        foreignTransactionId: candidate.id,
        reservationId: input.reservationId,
        foreignTxHash: hash,
        sourceChainKey: input.sourceChainKey,
      })
      .returning();
    return { created: true, candidate, job };
  });
}

export async function getVerification(
  db: Database,
  configVersion: string,
  reservationId: string,
) {
  const candidates = await db
    .select({ candidate: foreignTransactions, job: proofJobs })
    .from(foreignTransactions)
    .leftJoin(
      proofJobs,
      eq(proofJobs.foreignTransactionId, foreignTransactions.id),
    )
    .where(
      and(
        eq(foreignTransactions.configVersion, configVersion),
        eq(foreignTransactions.reservationId, reservationId),
      ),
    )
    .orderBy(desc(foreignTransactions.registeredAt));
  for (const row of candidates) {
    if (row.job) continue;
    const [job] = await db
      .insert(proofJobs)
      .values({
        foreignTransactionId: row.candidate.id,
        reservationId,
        foreignTxHash: row.candidate.transactionHash,
        sourceChainKey: row.candidate.sourceChainKey,
      })
      .onConflictDoNothing()
      .returning();
    row.job = job ?? null;
  }
  return candidates;
}

export async function claimDueJob(
  db: Database,
  owner: string,
  leaseMs = 60_000,
) {
  const [claimed] = await db.execute(sql`
    WITH candidate AS (
      SELECT j.id FROM mozy.proof_jobs j
      JOIN mozy.foreign_transactions f ON f.id = j.foreign_transaction_id
      WHERE j.status NOT IN ('CONFIRMED', 'TERMINAL_REJECTED')
        AND j.next_attempt_at <= now()
        AND (j.lease_expires_at IS NULL OR j.lease_expires_at < now())
        AND (f.superseded_at IS NULL OR j.status = 'SUBMITTING' OR j.resume_status = 'SUBMITTING')
      ORDER BY j.next_attempt_at ASC
      FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE mozy.proof_jobs j SET lease_owner = ${owner}, lease_expires_at = now() + (${leaseMs} * interval '1 millisecond'), updated_at = now()
    FROM candidate WHERE j.id = candidate.id RETURNING j.id
  `);
  if (!claimed) return undefined;
  return db.query.proofJobs.findFirst({
    where: and(
      eq(proofJobs.id, BigInt(String(claimed.id))),
      eq(proofJobs.leaseOwner, owner),
    ),
  });
}

export async function releaseJob(
  db: Database,
  id: bigint,
  owner: string,
  values: Partial<typeof proofJobs.$inferInsert>,
) {
  const [row] = await db
    .update(proofJobs)
    .set({
      ...values,
      leaseOwner: null,
      leaseExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(proofJobs.id, id), eq(proofJobs.leaseOwner, owner)))
    .returning();
  return row;
}

export async function renewJobLease(
  db: Database,
  id: bigint,
  owner: string,
  leaseMs = 60_000,
) {
  await db
    .update(proofJobs)
    .set({
      leaseExpiresAt: new Date(Date.now() + leaseMs),
      updatedAt: new Date(),
    })
    .where(and(eq(proofJobs.id, id), eq(proofJobs.leaseOwner, owner)));
}

export async function getCandidateForJob(
  db: Database,
  foreignTransactionId: bigint,
) {
  return db.query.foreignTransactions.findFirst({
    where: eq(foreignTransactions.id, foreignTransactionId),
  });
}

export async function heartbeat(
  db: Database,
  configVersion: string,
  streamKey: string,
  values: Partial<typeof syncCursors.$inferInsert> = {},
) {
  await db
    .insert(syncCursors)
    .values({
      configVersion,
      streamKey,
      ...values,
      heartbeatAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [syncCursors.configVersion, syncCursors.streamKey],
      set: { ...values, heartbeatAt: new Date(), updatedAt: new Date() },
    });
}

export async function getHeartbeats(db: Database, configVersion: string) {
  return db
    .select()
    .from(syncCursors)
    .where(
      and(
        eq(syncCursors.configVersion, configVersion),
        inArray(syncCursors.streamKey, ["worker", "indexer", "reconciler"]),
      ),
    )
    .orderBy(asc(syncCursors.streamKey));
}

export function safePhase(status: ProofJobStatus) {
  if (status === "DETECTED" || status === "WAITING_SOURCE_CONFIRMATION")
    return "delivery_submitted" as const;
  if (status === "WAITING_ATTESTATION" || status === "RETRYABLE")
    return "waiting_for_verification" as const;
  if (status === "PROOF_READY") return "proof_ready" as const;
  if (status === "SUBMITTING") return "settlement_submitted" as const;
  if (status === "CONFIRMED") return "payment_confirmed" as const;
  return "candidate_not_accepted" as const;
}
