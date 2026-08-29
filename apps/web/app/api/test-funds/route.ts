import { releaseConfig } from "@mozy/chain-config";
import { verifyMessage, type Hex } from "viem";
import { NextResponse } from "next/server";
import { buildTestFundsClaimStatement, testFundsClaimSchema } from "@/features/test-funds/claim";
import type { UnsignedTestFundsClaim } from "@/features/test-funds/types";
import { dispenseTestFunds, TestFundsUnavailableError } from "@/lib/test-funds/dispenser";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 4_096;
const MAX_STATEMENT_LIFETIME_MS = 5 * 60 * 1_000;
const CLOCK_TOLERANCE_MS = 30 * 1_000;

function failure(status: number, reason: string, message: string) {
  return NextResponse.json({ ok: false, reason, message }, { status });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return failure(415, "malformed_request", "Send this test-funds request as JSON.");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return failure(413, "malformed_request", "The test-funds request is too large.");
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return failure(400, "malformed_request", "The test-funds request is not valid JSON.");
  }
  const parsed = testFundsClaimSchema.safeParse(json);
  if (!parsed.success) {
    return failure(400, "malformed_request", "The test-funds request is incomplete or invalid.");
  }
  const body = parsed.data;
  if (body.configVersion !== releaseConfig.configVersion) {
    return failure(400, "unsupported_environment", "This request belongs to an unsupported Mozy release.");
  }
  const requestOrigin = request.headers.get("origin");
  if (!requestOrigin || requestOrigin !== body.origin) {
    return failure(400, "origin_mismatch", "The request origin does not match this Mozy session.");
  }
  const issued = Date.parse(body.issuedAt);
  const expires = Date.parse(body.expiresAt);
  const now = Date.now();
  if (issued > now + CLOCK_TOLERANCE_MS || expires <= now || expires <= issued || expires - issued > MAX_STATEMENT_LIFETIME_MS) {
    return failure(401, "signature_expired", "This test-funds signature has expired. Sign a fresh request.");
  }
  const { signature, ...unsigned } = body;
  const valid = await verifyMessage({
    address: body.address,
    message: buildTestFundsClaimStatement(unsigned as UnsignedTestFundsClaim),
    signature: signature as Hex,
  }).catch(() => false);
  if (!valid) {
    return failure(401, "signature_invalid", "The connected wallet signature could not be verified.");
  }
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipAddress = forwarded || request.headers.get("x-real-ip") || "unknown";
  try {
    const response = await dispenseTestFunds(body.address, ipAddress);
    return NextResponse.json(response, { status: response.status === "rate_limited" ? 429 : response.ok ? 200 : 503 });
  } catch (error) {
    const message = error instanceof TestFundsUnavailableError
      ? "The test-funds dispenser is temporarily unavailable. Nothing was sent from your wallet."
      : "Mozy couldn’t prepare the testnet funds. Nothing was sent from your wallet.";
    return failure(503, "dispenser_unavailable", message);
  }
}
