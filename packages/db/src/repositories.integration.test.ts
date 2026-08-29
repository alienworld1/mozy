import assert from "node:assert/strict";
import { after, it } from "node:test";
import { and, count, eq } from "drizzle-orm";
import { claimDueJob, registerCandidate } from "./repositories";
import { closeDatabase, getDatabase } from "./client";
import { foreignTransactions, proofJobs, protocolEvents } from "./schema";

const databaseUrl = process.env.MOZY_TEST_DATABASE_URL;

it(
  "persists registration idempotently, leases once, and deduplicates events",
  { skip: !databaseUrl },
  async () => {
    process.env.DATABASE_URL = databaseUrl;
    const db = getDatabase();
    const configVersion = `module9-test-${Date.now()}`;
    const input = {
      configVersion,
      reservationId: "340282366920938463463374607431768211457",
      foreignChainId: 11155111n,
      sourceChainKey: 1n,
      transactionHash: `0x${"12".repeat(32)}` as `0x${string}`,
      solver: `0x${"34".repeat(20)}` as `0x${string}`,
      source: "external" as const,
    };
    try {
      const first = await registerCandidate(db, input);
      const repeated = await registerCandidate(db, input);
      assert.equal(first.created, true);
      assert.equal(repeated.created, false);
      assert.equal(first.candidate.id, repeated.candidate.id);
      assert.equal(first.job.id, repeated.job.id);

      const claims = await Promise.all([
        claimDueJob(db, "worker-a"),
        claimDueJob(db, "worker-b"),
      ]);
      assert.equal(claims.filter(Boolean).length, 1);
      const claimed = claims.find((claim) => claim !== undefined);
      assert.equal(claimed?.foreignTransactionId, first.candidate.id);
      assert.equal(claimed?.foreignTxHash, input.transactionHash);
      assert.ok(["worker-a", "worker-b"].includes(claimed?.leaseOwner ?? ""));

      const event = {
        chainId: 102031n,
        contractAddress: `0x${"56".repeat(20)}`,
        blockNumber: 1n,
        blockHash: `0x${"78".repeat(32)}`,
        transactionHash: `0x${"90".repeat(32)}`,
        transactionIndex: 0,
        logIndex: 0,
        eventName: "ReservationCreated",
        reservationId: input.reservationId,
        payload: { reservationId: input.reservationId },
        confirmedAtBlock: 3n,
      };
      await db.insert(protocolEvents).values(event).onConflictDoNothing();
      await db.insert(protocolEvents).values(event).onConflictDoNothing();
      const [eventCount] = await db
        .select({ value: count() })
        .from(protocolEvents)
        .where(
          and(
            eq(protocolEvents.chainId, event.chainId),
            eq(protocolEvents.transactionHash, event.transactionHash),
            eq(protocolEvents.logIndex, 0),
          ),
        );
      assert.equal(eventCount.value, 1);
    } finally {
      await db
        .delete(protocolEvents)
        .where(eq(protocolEvents.reservationId, input.reservationId));
      const candidates = await db
        .select({ id: foreignTransactions.id })
        .from(foreignTransactions)
        .where(eq(foreignTransactions.configVersion, configVersion));
      for (const candidate of candidates)
        await db
          .delete(proofJobs)
          .where(eq(proofJobs.foreignTransactionId, candidate.id));
      await db
        .delete(foreignTransactions)
        .where(eq(foreignTransactions.configVersion, configVersion));
    }
  },
);

after(async () => {
  if (databaseUrl) await closeDatabase();
});
