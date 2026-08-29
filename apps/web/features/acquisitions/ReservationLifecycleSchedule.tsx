"use client";

import Link from "next/link";
import { releaseConfig } from "@mozy/chain-config";
import { InlineRecoveryMessage } from "@/components/states/InlineRecoveryMessage";
import { StructuralSkeleton } from "@/components/states/StructuralSkeleton";
import { useReceiptAvailability } from "@/features/receipts/useReceiptAvailability";
import { formatDateTime, formatTokenAmount } from "./format";
import { reservationStatuses, type Reservation } from "./types";

export function ReservationLifecycleSchedule({ reservations, loading, degraded, onRetry }: { reservations: Reservation[]; loading: boolean; degraded: boolean; onRetry: () => void }) {
  const settledIds = reservations.filter((reservation) => reservation.status === 2).map((reservation) => reservation.id.toString());
  const availability = useReceiptAvailability(settledIds);
  return (
    <section className="mt-12" aria-labelledby="reservation-lifecycle-title">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="reservation-lifecycle-title" className="text-xl font-medium">Reservation history</h2>
        {loading && reservations.length ? <span className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">Refreshing</span> : null}
      </div>
      {loading && !reservations.length ? <div className="mt-5"><StructuralSkeleton /></div> : null}
      {degraded ? <InlineRecoveryMessage title="History is catching up." message="This acquisition’s canonical quantities and funds are still current. Reservation enrichment is unavailable; refresh history next." onRetry={onRetry} /> : null}
      {!loading && !degraded && !reservations.length ? <p className="mt-5 border-y border-line py-6 text-sm text-ink-secondary">No additional history yet.</p> : null}
      {reservations.length ? (
        <ul className="mt-5 border-t border-line">
          {reservations.map((reservation) => {
            const id = reservation.id.toString();
            const receiptAvailable = availability.data?.has(id) ?? false;
            const destination = reservation.status === 2 && receiptAvailable ? `/activity/receipts/${id}` : `/solver/reservations/${id}`;
            return (
              <li key={id} className="grid gap-4 border-b border-line py-5 lg:grid-cols-[0.55fr_0.65fr_0.9fr_0.9fr_1fr_1fr_auto] lg:items-center">
                <div><span className="block text-[10px] text-ink-tertiary lg:hidden">RESERVATION</span><span className="font-mono text-sm">R{id}</span></div>
                <div><span className="block text-[10px] text-ink-tertiary lg:hidden">STATUS</span><span className="border-l-2 border-line-strong pl-2 text-xs font-medium uppercase">{reservationStatuses[reservation.status] ?? "Unknown"}</span></div>
                <div><span className="block text-[10px] text-ink-tertiary lg:hidden">QUANTITY</span><span className="font-mono text-xs tabular-nums">{formatTokenAmount(reservation.quantity, releaseConfig.deliveryToken.decimals)} {releaseConfig.deliveryToken.symbol}</span></div>
                <div><span className="block text-[10px] text-ink-tertiary lg:hidden">LOCKED PAYOUT</span><span className="font-mono text-xs tabular-nums">{formatTokenAmount(reservation.lockedPayout, releaseConfig.settlementToken.decimals)} {releaseConfig.settlementToken.symbol}</span></div>
                <div><span className="block text-[10px] text-ink-tertiary lg:hidden">SOLVER</span><span className="block truncate font-mono text-xs" title={reservation.solver}>{reservation.solver.slice(0, 8)}…{reservation.solver.slice(-6)}</span></div>
                <div><span className="block text-[10px] text-ink-tertiary lg:hidden">DEADLINE</span><span className="text-xs">{formatDateTime(reservation.deliveryDeadline)}</span></div>
                <div>
                  <Link href={destination} className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal">{reservation.status === 2 ? (receiptAvailable ? "View receipt" : "Inspect reservation") : reservation.status === 1 ? "View release" : "Continue delivery"}</Link>
                  {reservation.status === 2 && !receiptAvailable ? <span className="block text-[10px] text-ink-tertiary">Receipt is being prepared</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
