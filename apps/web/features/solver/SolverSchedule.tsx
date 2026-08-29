"use client";

import Link from "next/link";
import { getAddress } from "viem";
import { useConnection } from "wagmi";
import { EmptyState } from "@/components/states/EmptyState";
import { InlineRecoveryMessage } from "@/components/states/InlineRecoveryMessage";
import { StructuralSkeleton } from "@/components/states/StructuralSkeleton";
import { useHydrated } from "@/hooks/useHydrated";
import { SolverReservationScheduleRow } from "./SolverReservationScheduleRow";
import { useSolverReservations } from "./useSolverReservations";
import { useReceiptAvailability } from "@/features/receipts/useReceiptAvailability";

export function SolverSchedule() {
  const hydrated = useHydrated();
  const connection = useConnection();
  const solver = connection.address
    ? getAddress(connection.address)
    : undefined;
  const query = useSolverReservations(solver);
  const settledIds = query.data?.filter((row) => row.reservation.status === 2).map((row) => row.reservation.id.toString()) ?? [];
  const receiptAvailability = useReceiptAvailability(settledIds);
  if (!hydrated || connection.status === "reconnecting")
    return <StructuralSkeleton />;
  if (!solver)
    return (
      <EmptyState
        message="Connect your wallet to view reservations for this address."
        supporting="Your reservations are scoped to the wallet that created them."
      />
    );
  if (query.isLoading) return <StructuralSkeleton />;
  if (query.isError)
    return (
      <InlineRecoveryMessage
        title="Reservations are unavailable."
        message="We couldn’t refresh this wallet’s canonical Creditcoin reservations."
        onRetry={() => void query.refetch()}
      />
    );
  if (!query.data?.length)
    return (
      <section className="mt-10 border-y border-line py-12">
        <p className="max-w-xl text-[15px] leading-6 text-ink-secondary">
          Reserve a fill to lock your payout before delivering.
        </p>
        <Link
          href="/markets"
          className="mt-6 inline-flex min-h-11 items-center rounded-control bg-signal px-4 text-sm font-medium text-paper-raised outline-none hover:bg-signal-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
        >
          Browse markets
        </Link>
      </section>
    );
  const active = query.data.filter((row) => row.reservation.status === 0);
  const history = query.data.filter(
    (row) => row.reservation.status === 1 || row.reservation.status === 2,
  );
  return (
    <div className="mt-10 space-y-12">
      {active.length ? (
        <section aria-labelledby="active-reservations-title">
          <h2 id="active-reservations-title" className="text-xl font-medium">
            Active reservations
          </h2>
          <ul className="mt-5 border-t border-line">
            {active.map((row) => (
              <SolverReservationScheduleRow
                key={row.reservation.id.toString()}
                row={row}
                receiptAvailable={receiptAvailability.data?.has(row.reservation.id.toString()) ?? false}
                receiptAvailabilityLoading={receiptAvailability.isLoading}
              />
            ))}
          </ul>
        </section>
      ) : null}
      {history.length ? (
        <section aria-labelledby="reservation-history-title">
          <h2 id="reservation-history-title" className="text-xl font-medium">
            History
          </h2>
          <ul className="mt-5 border-t border-line">
            {history.map((row) => (
              <SolverReservationScheduleRow
                key={row.reservation.id.toString()}
                row={row}
                receiptAvailable={receiptAvailability.data?.has(row.reservation.id.toString()) ?? false}
                receiptAvailabilityLoading={receiptAvailability.isLoading}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
