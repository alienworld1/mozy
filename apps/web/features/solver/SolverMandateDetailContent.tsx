"use client";

import { useMemo } from "react";
import { AcquisitionInstrument } from "@/features/acquisitions/instrument/AcquisitionInstrument";
import { useFillMeasurement } from "@/features/acquisitions/instrument/useFillMeasurement";
import type {
  Acquisition,
  InstrumentModel,
  Reservation,
} from "@/features/acquisitions/types";
import { ReservationTerms } from "./ReservationTerms";
import { useReservationQuote } from "./useReservationQuote";

const noReservations: Reservation[] = [];

export function SolverMandateDetailContent({
  acquisition,
  model,
  accountingVerified,
  onRefresh,
  reservationDetails,
  reservationDetailsLoading,
  reservationDetailsError,
  onRetryReservations,
}: {
  acquisition: Acquisition;
  model: InstrumentModel;
  accountingVerified: boolean;
  onRefresh: () => Promise<unknown>;
  reservationDetails?: Reservation[];
  reservationDetailsLoading: boolean;
  reservationDetailsError: boolean;
  onRetryReservations: () => Promise<unknown>;
}) {
  const measurement = useFillMeasurement({
    mandate: acquisition.mandate,
    model,
    accountingVerified,
    onAcquisitionRefresh: onRefresh,
  });
  const fullQuote = useReservationQuote(
    acquisition.mandate.id,
    measurement.quote?.quantity,
    !!measurement.quote && accountingVerified,
  );
  const reservationSum = useMemo(
    () =>
      (reservationDetails ?? noReservations).reduce(
        (sum, reservation) => sum + reservation.quantity,
        0n,
      ),
    [reservationDetails],
  );
  const reconciled =
    !reservationDetailsLoading &&
    !reservationDetailsError &&
    reservationDetails !== undefined &&
    reservationSum === model.reservedQuantity;
  const failed =
    reservationDetailsError ||
    (!reservationDetailsLoading &&
      reservationDetails !== undefined &&
      !reconciled);

  return (
    <>
      <AcquisitionInstrument
        mandate={acquisition.mandate}
        model={model}
        measurement={measurement}
        reservations={
          reconciled ? (reservationDetails ?? noReservations) : noReservations
        }
        reservationDetailsLoading={reservationDetailsLoading}
        reservationDetailsFailed={failed}
        onRetryReservations={onRetryReservations}
      />
      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.42fr)] lg:gap-12">
        <section aria-labelledby="commitment-title">
          <p className="font-mono text-[10px] tracking-wide text-ink-tertiary">
            BEFORE YOU RESERVE
          </p>
          <h2 id="commitment-title" className="mt-2 text-xl font-medium">
            One wallet, two networks
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-ink-secondary">
            The address that reserves this fill on Creditcoin must send the
            approved delivery token directly to the buyer wallet on Ethereum
            Sepolia. The payout and bond lock only after canonical confirmation.
          </p>
          <ol className="mt-6 space-y-5 border-y border-line py-6 text-sm leading-6">
            <li className="grid grid-cols-[28px_1fr] gap-3">
              <span className="font-mono text-xs text-ink-tertiary">01</span>
              <span>
                Approve only the exact BTKT reservation bond when needed.
              </span>
            </li>
            <li className="grid grid-cols-[28px_1fr] gap-3">
              <span className="font-mono text-xs text-ink-tertiary">02</span>
              <span>
                Reserve the measured interval and wait for its canonical
                R-reference.
              </span>
            </li>
            <li className="grid grid-cols-[28px_1fr] gap-3">
              <span className="font-mono text-xs text-ink-tertiary">03</span>
              <span>
                Use the same wallet to deliver directly on Ethereum Sepolia.
              </span>
            </li>
          </ol>
        </section>
        <ReservationTerms
          mandateId={acquisition.mandate.id}
          quote={fullQuote.data}
          quoteLoading={fullQuote.isFetching}
          quoteError={fullQuote.isError}
          onRefresh={() => void onRefresh()}
        />
      </div>
    </>
  );
}
