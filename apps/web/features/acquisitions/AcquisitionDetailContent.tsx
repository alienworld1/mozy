"use client";

import { useMemo } from "react";
import { BudgetSchedule } from "./BudgetSchedule";
import { LifecycleControls } from "./LifecycleControls";
import { QuantitySchedule } from "./QuantitySchedule";
import { TechnicalDisclosure } from "./TechnicalDisclosure";
import { TermsSchedule } from "./TermsSchedule";
import type { Acquisition, InstrumentModel, Reservation } from "./types";
import { AcquisitionInstrument } from "./instrument/AcquisitionInstrument";
import { useFillMeasurement } from "./instrument/useFillMeasurement";

const noReservations: Reservation[] = [];

export function AcquisitionDetailContent({
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
  const { mandate, account } = acquisition;
  const measurement = useFillMeasurement({ mandate, model, accountingVerified, onAcquisitionRefresh: onRefresh });
  const reservationSum = useMemo(() => (reservationDetails ?? noReservations).reduce((sum, reservation) => sum + reservation.quantity, 0n), [reservationDetails]);
  const reservationDetailsReconciled = !reservationDetailsLoading && !reservationDetailsError && reservationDetails !== undefined && reservationSum === model.reservedQuantity;
  const reservations = reservationDetailsReconciled ? reservationDetails ?? noReservations : noReservations;
  const reservationDetailsFailed = reservationDetailsError || (!reservationDetailsLoading && reservationDetails !== undefined && !reservationDetailsReconciled);

  return <>
    <AcquisitionInstrument
      mandate={mandate}
      model={model}
      measurement={measurement}
      reservations={reservations}
      reservationDetailsLoading={reservationDetailsLoading}
      reservationDetailsFailed={reservationDetailsFailed}
      onRetryReservations={onRetryReservations}
    />
    <div className="mt-12 grid gap-12 lg:grid-cols-2">
      <QuantitySchedule
        model={model}
        reservations={reservations}
        reservationDetailsReconciled={reservationDetailsReconciled}
        quote={measurement.quote}
      />
      <BudgetSchedule mandate={mandate} account={account} />
    </div>
    <TermsSchedule mandate={mandate} />
    {!accountingVerified ? <p className="mt-8 border-l-2 border-error pl-4 text-sm text-error">This acquisition’s accounting could not be verified. Refresh before continuing.</p> : null}
    <LifecycleControls acquisition={acquisition} accountingVerified={accountingVerified} onRefresh={onRefresh} />
    <TechnicalDisclosure mandate={mandate} />
  </>;
}
