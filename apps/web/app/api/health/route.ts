import "server-only";
import { releaseConfig } from "@mozy/chain-config";
import { getDatabase, getHeartbeats, proofJobs, syncCursors } from "@mozy/db";
import { and, eq, isNull, lt, notInArray, or } from "drizzle-orm";
import { createPublicClient, http } from "viem";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = getDatabase();
    const client = createPublicClient({
      chain: releaseConfig.creditcoin,
      transport: http(releaseConfig.creditcoin.rpcUrls.default.http[0]),
    });
    const [heartbeats, indexer, overdueJobs, head] = await Promise.all([
      getHeartbeats(db, releaseConfig.configVersion),
      db.query.syncCursors.findFirst({
        where: and(
          eq(syncCursors.configVersion, releaseConfig.configVersion),
          eq(syncCursors.streamKey, "indexer"),
        ),
      }),
      db
        .select({ id: proofJobs.id })
        .from(proofJobs)
        .where(
          and(
            notInArray(proofJobs.status, ["CONFIRMED", "TERMINAL_REJECTED"]),
            lt(proofJobs.nextAttemptAt, new Date(Date.now() - 120_000)),
            or(
              isNull(proofJobs.leaseExpiresAt),
              lt(proofJobs.leaseExpiresAt, new Date()),
            ),
          ),
        )
        .limit(1),
      client.getBlockNumber(),
    ]);
    const ages = new Map(
      heartbeats.map((row) => [
        row.streamKey,
        Date.now() - row.heartbeatAt.getTime(),
      ]),
    );
    const indexLag =
      indexer?.lastSafeBlock === null || indexer?.lastSafeBlock === undefined
        ? Infinity
        : Number(head - indexer.lastSafeBlock);
    const checks = {
      database: "ok",
      indexer:
        (ages.get("indexer") ?? Infinity) <= 90_000 && indexLag <= 22
          ? "ok"
          : "degraded",
      worker:
        (ages.get("worker") ?? Infinity) <= 90_000 && overdueJobs.length === 0
          ? "ok"
          : "degraded",
      reconciler:
        (ages.get("reconciler") ?? Infinity) <= 90_000 ? "ok" : "degraded",
    } as const;
    return NextResponse.json({
      status: Object.values(checks).every((value) => value === "ok")
        ? "ok"
        : "degraded",
      checks,
    });
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        checks: {
          database: "degraded",
          indexer: "degraded",
          worker: "degraded",
          reconciler: "degraded",
        },
      },
      { status: 503 },
    );
  }
}
