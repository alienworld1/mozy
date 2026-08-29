import "server-only";
import { releaseConfig } from "@mozy/chain-config";
import { getDatabase, reservations } from "@mozy/db";
import { and, desc, eq } from "drizzle-orm";
import { getAddress, isAddress } from "viem";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ solver: string }> },
) {
  const { solver } = await params;
  if (!isAddress(solver))
    return NextResponse.json(
      { ok: false, message: "We couldn’t find reservations for that wallet." },
      { status: 400 },
    );
  try {
    const rows = await getDatabase()
      .select({
        reservationId: reservations.reservationId,
        updatedAt: reservations.updatedAt,
      })
      .from(reservations)
      .where(
        and(
          eq(reservations.configVersion, releaseConfig.configVersion),
          eq(reservations.solver, getAddress(solver).toLowerCase()),
        ),
      )
      .orderBy(desc(reservations.deliveryDeadline))
      .limit(128);
    return NextResponse.json({
      ok: true,
      reservationIds: rows.map((row) => row.reservationId),
      projectionFreshness:
        rows.length && Date.now() - rows[0].updatedAt.getTime() <= 90_000
          ? "fresh"
          : "refreshing",
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "We couldn’t refresh indexed reservations." },
      { status: 503 },
    );
  }
}
