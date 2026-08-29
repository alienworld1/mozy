import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getReceiptAvailability } from "@/lib/receipt-repository";
import { isReservationId } from "@/features/receipts/validation";

export const runtime = "nodejs";

const idsSchema = z
  .array(z.string().refine(isReservationId))
  .max(128)
  .transform((ids) => [...new Set(ids)]);

export async function GET(request: Request) {
  const parsed = idsSchema.safeParse(
    new URL(request.url).searchParams.getAll("reservationId"),
  );
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, message: "That receipt request isn't valid." },
      { status: 400 },
    );
  try {
    const available = await getReceiptAvailability(parsed.data);
    return NextResponse.json({
      ok: true,
      availableReservationIds: [...available],
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Receipt availability is still being refreshed." },
      { status: 503 },
    );
  }
}
