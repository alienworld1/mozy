"use client";

import { releaseConfig } from "@mozy/chain-config";
import Link from "next/link";
import {
  formatDateTime,
  formatTokenAmount,
} from "@/features/acquisitions/format";
import { reservationStatuses } from "@/features/acquisitions/types";
import { useCandidateRecords } from "./useCandidateRecords";
import { scheduleAnnotation } from "./verification";
import { useVerification } from "./useVerification";
import type { SolverReservationRow } from "./useSolverReservations";

export function SolverReservationScheduleRow({
  row,
  receiptAvailable,
  receiptAvailabilityLoading,
}: {
  row: SolverReservationRow;
  receiptAvailable: boolean;
  receiptAvailabilityLoading: boolean;
}) {
  const { reservation } = row;
  const candidates = useCandidateRecords(
    releaseConfig.configVersion,
    reservation.id.toString(),
    reservation.solver,
  );
  const verification = useVerification(reservation.id.toString());
  return (
    <li className="grid gap-4 border-b border-line py-6 lg:grid-cols-[0.65fr_0.65fr_0.9fr_0.9fr_1.2fr_auto] lg:items-center">
      <div>
        <span className="block text-xs text-ink-tertiary lg:hidden">
          RESERVATION
        </span>
        <span className="font-mono text-sm">R{reservation.id.toString()}</span>
        <span className="ml-2 font-mono text-xs text-ink-tertiary">
          M{reservation.mandateId.toString()}
        </span>
      </div>
      <div>
        <span className="block text-xs text-ink-tertiary lg:hidden">
          STATUS
        </span>
        <span className="border-l-2 border-line-strong pl-2 text-xs font-medium uppercase">
          {reservationStatuses[reservation.status] ?? "Unknown"}
        </span>
      </div>
      <div>
        <span className="block text-xs text-ink-tertiary lg:hidden">
          QUANTITY
        </span>
        <span className="font-mono text-sm tabular-nums">
          {formatTokenAmount(
            reservation.quantity,
            releaseConfig.deliveryToken.decimals,
          )}{" "}
          {releaseConfig.deliveryToken.symbol}
        </span>
      </div>
      <div>
        <span className="block text-xs text-ink-tertiary lg:hidden">
          PAYOUT
        </span>
        <span className="font-mono text-sm tabular-nums">
          {formatTokenAmount(
            reservation.lockedPayout,
            releaseConfig.settlementToken.decimals,
          )}{" "}
          {releaseConfig.settlementToken.symbol}
        </span>
      </div>
      <div>
        <span className="block text-xs text-ink-tertiary lg:hidden">
          DEADLINE / CANDIDATE
        </span>
        <span className="text-sm">
          {formatDateTime(reservation.deliveryDeadline)}
        </span>
        <span className="block text-xs text-ink-secondary">
          {verification.data
            ? scheduleAnnotation(verification.data.candidates[0])
            : candidates.current
              ? "Submitted"
              : "No transaction"}
        </span>
        {candidates.records
          .filter((record) =>
            ["replaced", "registration_rejected", "failed"].includes(
              record.localState,
            ),
          )
          .map((record) => (
            <span
              key={record.transactionHash}
              className="mt-1 block truncate font-mono text-[10px] text-ink-tertiary"
              title={record.transactionHash}
            >
              {record.localState.replace("_", " ")}:{" "}
              {record.transactionHash.slice(0, 10)}…
              {record.transactionHash.slice(-8)}
            </span>
          ))}
      </div>
      <div>
        <Link
          href={receiptAvailable ? `/activity/receipts/${reservation.id.toString()}` : `/solver/reservations/${reservation.id.toString()}`}
          className="inline-flex min-h-11 items-center justify-center rounded-control border border-line-strong px-4 text-sm font-medium outline-none hover:bg-wash focus-visible:outline-2 focus-visible:outline-signal"
        >
          {receiptAvailable ? "View receipt" : reservation.status === 0 ? "Continue delivery" : "Inspect reservation"}
        </Link>
        {reservation.status === 2 && !receiptAvailable ? <span className="mt-1 block text-[10px] text-ink-tertiary">{receiptAvailabilityLoading ? "Checking receipt…" : "Receipt is being prepared"}</span> : null}
      </div>
    </li>
  );
}
