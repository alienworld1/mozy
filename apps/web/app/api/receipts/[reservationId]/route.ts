import "server-only";

import { NextResponse } from "next/server";
import { getDeliveryReceipt } from "@/lib/receipt-repository";
import { isReservationId } from "@/features/receipts/validation";

export const runtime = "nodejs";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ reservationId: string }> },
) {
  const { reservationId } = await params;
  if (!isReservationId(reservationId))
    return NextResponse.json(
      { status: "not_found", message: "We couldn't find that delivery receipt." },
      { status: 404 },
    );
  try {
    const response = await getDeliveryReceipt(reservationId);
    const status =
      response.status === "complete"
        ? 200
        : response.status === "pending"
          ? 409
          : response.status === "not_found"
            ? 404
            : 503;
    return NextResponse.json(response, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        status: "unavailable",
        message: "The settlement is unchanged. Try rebuilding the receipt from confirmed data.",
      },
      { status: 503 },
    );
  }
}
