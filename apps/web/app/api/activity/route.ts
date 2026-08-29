import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getActivityPage,
  InvalidActivityCursorError,
} from "@/lib/activity-repository";

export const runtime = "nodejs";

const querySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success)
    return NextResponse.json(
      { reason: "invalid_request", message: "That activity request isn't valid." },
      { status: 400 },
    );
  try {
    return NextResponse.json(await getActivityPage(parsed.data), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof InvalidActivityCursorError)
      return NextResponse.json(
        {
          reason: "invalid_cursor",
          message: "That activity page link is no longer valid.",
        },
        { status: 400 },
      );
    return NextResponse.json(
      {
        reason: "activity_unavailable",
        message: "We couldn't load protocol activity. No protocol state was changed.",
      },
      { status: 503 },
    );
  }
}

