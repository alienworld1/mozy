import "server-only";
import { releaseConfig } from "@mozy/chain-config";
import { getDatabase, registerCandidate } from "@mozy/db";
import {
  createPublicClient,
  getAddress,
  http,
  verifyMessage,
  type Hex,
} from "viem";
import { NextResponse } from "next/server";
import { marketAbi } from "@/lib/acquisition-contracts";
import type { Reservation } from "@/features/acquisitions/types";
import {
  buildRegistrationStatement,
  candidateRegistrationSchema,
} from "@/features/solver/candidate-record";
import { checkRegistrationRateLimit } from "@/lib/registration-rate-limit";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 4_096;
const MAX_STATEMENT_LIFETIME_MS = 5 * 60 * 1_000;
const CLOCK_TOLERANCE_MS = 30 * 1_000;

function failure(status: number, reason: string, message: string) {
  return NextResponse.json({ ok: false, reason, message }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reservationId: string }> },
) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json"))
    return failure(415, "malformed_request", "Send this registration as JSON.");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES)
    return failure(
      413,
      "malformed_request",
      "The registration request is too large.",
    );
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return failure(
      400,
      "malformed_request",
      "The registration request is not valid JSON.",
    );
  }
  const parsed = candidateRegistrationSchema.safeParse(json);
  if (!parsed.success)
    return failure(
      400,
      "malformed_request",
      "The registration details are incomplete or invalid.",
    );
  const body = parsed.data;
  const { reservationId } = await params;
  if (!/^[1-9]\d*$/.test(reservationId) || reservationId !== body.reservationId)
    return failure(
      400,
      "reservation_mismatch",
      "The reservation reference does not match this request.",
    );
  if (
    body.configVersion !== releaseConfig.configVersion ||
    body.foreignChainId !== releaseConfig.foreign.id
  )
    return failure(
      400,
      "unsupported_environment",
      "This transaction belongs to an unsupported release environment.",
    );
  const requestOrigin = request.headers.get("origin");
  if (!requestOrigin || requestOrigin !== body.origin)
    return failure(
      400,
      "origin_mismatch",
      "The registration origin does not match this request.",
    );
  const issued = Date.parse(body.issuedAt);
  const expires = Date.parse(body.expiresAt);
  const now = Date.now();
  if (
    issued > now + CLOCK_TOLERANCE_MS ||
    expires <= now ||
    expires <= issued ||
    expires - issued > MAX_STATEMENT_LIFETIME_MS
  )
    return failure(
      401,
      "signature_expired",
      "This registration signature has expired. Sign a fresh request.",
    );
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  try {
    const allowed = await checkRegistrationRateLimit(
      body.solver,
      reservationId,
      forwarded || request.headers.get("x-real-ip") || "unknown",
    );
    if (!allowed)
      return failure(
        429,
        "rate_limited",
        "Too many registration attempts. Wait a moment, then try again.",
      );
  } catch {
    return failure(
      503,
      "rate_limit_unavailable",
      "We couldn’t register this transaction right now. The foreign transfer is unchanged.",
    );
  }

  const client = createPublicClient({
    chain: releaseConfig.creditcoin,
    transport: http(releaseConfig.creditcoin.rpcUrls.default.http[0]),
  });
  let reservation: Reservation;
  let requirements: readonly [
    {
      sourceChainKey: bigint;
      foreignToken: `0x${string}`;
      foreignTokenDecimals: number;
      settlementToken: `0x${string}`;
      settlementTokenDecimals: number;
      enabled: boolean;
    },
    `0x${string}`,
    `0x${string}`,
  ];
  try {
    [reservation, requirements] = await Promise.all([
      client.readContract({
        address: releaseConfig.contracts.market,
        abi: marketAbi,
        functionName: "getReservation",
        args: [BigInt(reservationId)],
      }) as Promise<Reservation>,
      client.readContract({
        address: releaseConfig.contracts.market,
        abi: marketAbi,
        functionName: "getReservationRequirements",
        args: [BigInt(reservationId)],
      }),
    ]);
  } catch {
    return failure(
      404,
      "reservation_not_found",
      "We couldn’t find this reservation on Creditcoin.",
    );
  }
  if (reservation.status !== 0)
    return failure(
      409,
      "reservation_not_active",
      "This reservation is no longer accepting delivery transactions.",
    );
  if (getAddress(body.solver) !== getAddress(reservation.solver))
    return failure(
      403,
      "wrong_solver",
      "Connect the reserved solver wallet to register this transaction.",
    );
  const { signature, ...unsigned } = body;
  const valid = await verifyMessage({
    address: reservation.solver,
    message: buildRegistrationStatement(unsigned),
    signature: signature as Hex,
  }).catch(() => false);
  if (!valid)
    return failure(
      401,
      "signature_invalid",
      "The wallet signature could not be verified.",
    );
  if (
    requirements[0].sourceChainKey !== releaseConfig.foreign.sourceChainKey ||
    getAddress(requirements[0].foreignToken) !==
      getAddress(releaseConfig.deliveryToken.address) ||
    getAddress(requirements[0].settlementToken) !==
      getAddress(releaseConfig.settlementToken.address)
  )
    return failure(
      400,
      "unsupported_environment",
      "This transaction belongs to an unsupported release environment.",
    );
  try {
    const result = await registerCandidate(getDatabase(), {
      configVersion: body.configVersion,
      reservationId,
      foreignChainId: BigInt(body.foreignChainId),
      sourceChainKey: requirements[0].sourceChainKey,
      transactionHash: body.transactionHash.toLowerCase() as `0x${string}`,
      solver: getAddress(body.solver).toLowerCase() as `0x${string}`,
      source: body.source,
      replacesHash: body.replacesHash?.toLowerCase() as
        | `0x${string}`
        | undefined,
    });
    return NextResponse.json(
      {
        ok: true,
        status: "candidate_registered",
        candidateId: result.candidate.id.toString(),
        reservationId,
        transactionHash: result.candidate.transactionHash,
        phase: result.job.status,
        canonicalReservationStatus: "Active",
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "replacement_not_found")
      return failure(
        400,
        "replacement_not_found",
        "The transaction you are replacing is not registered for this reservation.",
      );
    if (error instanceof Error && error.message === "replacement_not_safe")
      return failure(
        409,
        "replacement_not_safe",
        "This reservation is not accepting another delivery transaction.",
      );
    if (
      error instanceof Error &&
      error.message === "settlement_outcome_uncertain"
    )
      return failure(
        409,
        "settlement_outcome_uncertain",
        "Settlement status is being checked. Do not submit another delivery.",
      );
    return failure(
      503,
      "database_unavailable",
      "We couldn’t register this transaction right now. The foreign transfer is unchanged.",
    );
  }
}
