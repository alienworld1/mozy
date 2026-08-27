"use client";

import { releaseConfig } from "@mozy/chain-config";
import dynamic from "next/dynamic";
import { formatExactTokenAmount } from "../format";
import type { InstrumentModel, Mandate, Reservation } from "../types";
import { FillMeasurement } from "./FillMeasurement";
import { InstrumentChartLoading } from "./InstrumentChartLoading";
import type { useFillMeasurement } from "./useFillMeasurement";

type Measurement = ReturnType<typeof useFillMeasurement>;

const AcquisitionInstrumentChart = dynamic(
  () => import("./AcquisitionInstrumentChart").then((module) => module.AcquisitionInstrumentChart),
  { ssr: false, loading: InstrumentChartLoading },
);

export function AcquisitionInstrument({
  mandate,
  model,
  measurement,
  reservations,
  reservationDetailsLoading,
  reservationDetailsFailed,
  onRetryReservations,
}: {
  mandate: Mandate;
  model: InstrumentModel;
  measurement: Measurement;
  reservations: Reservation[];
  reservationDetailsLoading: boolean;
  reservationDetailsFailed: boolean;
  onRetryReservations: () => unknown;
}) {
  const flatPrice = model.pricingMode === "Limit" || model.startPrice === model.endPrice;
  const description = model.pricingMode === "Limit"
    ? "One payout price across the full target."
    : `Payout price moves linearly from ${formatExactTokenAmount(model.startPrice, releaseConfig.settlementToken.decimals)} to ${formatExactTokenAmount(model.endPrice, releaseConfig.settlementToken.decimals)} ${releaseConfig.settlementToken.symbol} / ${releaseConfig.deliveryToken.symbol} across the target.`;

  return (
    <section className="mt-10 border-y border-line py-8" aria-labelledby="instrument-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] font-medium tracking-wider text-ink-tertiary">MANDATE M{mandate.id.toString()}</p>
          <h2 id="instrument-title" className="mt-2 text-[22px] leading-7 font-medium">Acquisition structure</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-secondary">{description}</p>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="font-mono text-[10px] tracking-wide text-ink-tertiary">CURRENT POSITION</p>
          <p className="mt-1 break-all font-mono text-sm tabular-nums">{formatExactTokenAmount(model.currentPosition, releaseConfig.deliveryToken.decimals)} {releaseConfig.deliveryToken.symbol}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:gap-10">
        <figure className="min-w-0 lg:col-span-8" aria-labelledby="instrument-title instrument-caption">
          <div className="mb-4 grid grid-cols-2 gap-4 font-mono text-[10px] leading-4 text-ink-secondary">
            <p className="break-all"><span className="block text-ink-tertiary">START PRICE</span>{formatExactTokenAmount(model.startPrice, releaseConfig.settlementToken.decimals)} {releaseConfig.settlementToken.symbol} / {releaseConfig.deliveryToken.symbol}</p>
            <p className="break-all text-right"><span className="block text-ink-tertiary">{flatPrice ? "LIMIT PRICE" : "END PRICE"}</span>{formatExactTokenAmount(model.endPrice, releaseConfig.settlementToken.decimals)} {releaseConfig.settlementToken.symbol} / {releaseConfig.deliveryToken.symbol}</p>
          </div>
          <AcquisitionInstrumentChart model={model} reservations={reservations} quote={measurement.quote} transitionSnapshotConfirmed={!reservationDetailsLoading && !reservationDetailsFailed} />
          <figcaption id="instrument-caption" className="mt-4 text-xs leading-5 text-ink-tertiary">
            Quantity runs from zero to {formatExactTokenAmount(model.targetQuantity, releaseConfig.deliveryToken.decimals)} {releaseConfig.deliveryToken.symbol}. The price rule spans the full target; current state is arranged as Settled, Reserved, then Open.
          </figcaption>
          {reservationDetailsLoading && model.reservedQuantity > 0n ? <p className="mt-4 font-mono text-xs text-ink-secondary" role="status">Reservation details loading…</p> : null}
          {reservationDetailsFailed ? <div className="mt-4 border-l-2 border-error pl-3" role="alert">
            <p className="text-sm leading-5 text-ink-secondary">Reservation details couldn&apos;t be refreshed. The total reserved amount is still shown from Creditcoin.</p>
            <button type="button" onClick={() => void onRetryReservations()} className="mt-2 min-h-11 text-sm font-medium underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal">Retry details</button>
          </div> : null}
        </figure>

        <div className="lg:col-span-4">
          <FillMeasurement
            input={measurement.input}
            onInputChange={measurement.setInput}
            validation={measurement.validation}
            quote={measurement.quote}
            quoteError={measurement.quoteError}
            quoteLoading={measurement.quoteLoading}
            enabled={measurement.enabled}
            disabledMessage={measurement.disabledMessage}
            onRetry={measurement.retryQuote}
          />
        </div>
      </div>
    </section>
  );
}
