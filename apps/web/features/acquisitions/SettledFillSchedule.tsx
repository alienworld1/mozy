"use client";

import Link from "next/link";
import { releaseConfig } from "@mozy/chain-config";
import { useReceiptAvailability } from "@/features/receipts/useReceiptAvailability";
import { formatTokenAmount } from "./format";
import type { Reservation } from "./types";

export function SettledFillSchedule({ reservations }: { reservations: Reservation[] }) {
  const settled = reservations.filter((reservation) => reservation.status === 2);
  const availability = useReceiptAvailability(settled.map((reservation) => reservation.id.toString()));
  if (!settled.length) return null;
  return (
    <section className="mt-12" aria-labelledby="settled-fills-title">
      <h2 id="settled-fills-title" className="text-xl font-medium">Settled fills</h2>
      <ul className="mt-5 border-t border-line">
        {settled.map((reservation) => {
          const id = reservation.id.toString();
          const available = availability.data?.has(id) ?? false;
          return (
            <li key={id} className="grid gap-4 border-b border-line py-5 sm:grid-cols-[0.65fr_1fr_1fr_auto] sm:items-center">
              <div><span className="block text-[10px] text-ink-tertiary sm:hidden">RESERVATION</span><span className="font-mono text-sm">R{id}</span></div>
              <div><span className="block text-[10px] text-ink-tertiary sm:hidden">CREDITED</span><span className="font-mono text-sm tabular-nums">{formatTokenAmount(reservation.quantity, releaseConfig.deliveryToken.decimals)} {releaseConfig.deliveryToken.symbol}</span></div>
              <div><span className="block text-[10px] text-ink-tertiary sm:hidden">PAYOUT</span><span className="font-mono text-sm tabular-nums">{formatTokenAmount(reservation.lockedPayout, releaseConfig.settlementToken.decimals)} {releaseConfig.settlementToken.symbol}</span></div>
              {available ? (
                <Link href={`/activity/receipts/${id}`} className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal">View receipt</Link>
              ) : (
                <span className="inline-flex min-h-11 items-center text-xs text-ink-tertiary">Receipt is being prepared</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

