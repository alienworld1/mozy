import { releaseConfig } from "@mozy/chain-config";
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

  const client = createPublicClient({
    chain: releaseConfig.creditcoin,
    transport: http(releaseConfig.creditcoin.rpcUrls.default.http[0]),
  });
  let reservation: Reservation;
  try {
    reservation = (await client.readContract({
      address: releaseConfig.contracts.market,
      abi: marketAbi,
      functionName: "getReservation",
      args: [BigInt(reservationId)],
    })) as Reservation;
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
  return NextResponse.json({
    ok: true,
    status: "candidate_registered",
    reservationId,
    transactionHash: body.transactionHash.toLowerCase(),
    canonicalReservationStatus: "Active",
  });
}
