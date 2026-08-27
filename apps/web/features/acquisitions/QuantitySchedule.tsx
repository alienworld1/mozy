import { releaseConfig } from "@mozy/chain-config";
import { formatExactTokenAmount } from "./format";
import type { FillQuote, InstrumentModel, Reservation } from "./types";

export function QuantitySchedule({
  model,
  reservations,
  reservationDetailsReconciled,
  quote,
}: {
  model: InstrumentModel;
  reservations: Reservation[];
  reservationDetailsReconciled: boolean;
  quote?: FillQuote;
}) {
  const quantityValues = [
    ["Target", model.targetQuantity],
    ["Settled", model.settledQuantity],
    ["Reserved", model.reservedQuantity],
    ["Open", model.openQuantity],
    ["Current position", model.currentPosition],
  ] as const;
  const prices = [
    ["Pricing mode", model.pricingMode],
    ["Start price", `${formatExactTokenAmount(model.startPrice, releaseConfig.settlementToken.decimals)} ${releaseConfig.settlementToken.symbol} / ${releaseConfig.deliveryToken.symbol}`],
    ["End price", `${formatExactTokenAmount(model.endPrice, releaseConfig.settlementToken.decimals)} ${releaseConfig.settlementToken.symbol} / ${releaseConfig.deliveryToken.symbol}`],
  ] as const;

  return <section>
    <h2 className="text-lg font-medium">Quantity schedule</h2>
    <dl className="mt-4 divide-y divide-line border-y border-line">
      {quantityValues.map(([label, value]) => <div key={label} className="flex items-baseline justify-between gap-4 py-4"><dt className="text-sm text-ink-secondary">{label}</dt><dd className="break-all text-right text-xl font-medium tabular-nums">{formatExactTokenAmount(value, releaseConfig.deliveryToken.decimals)} <span className="text-sm font-normal text-ink-tertiary">{releaseConfig.deliveryToken.symbol}</span></dd></div>)}
      {prices.map(([label, value]) => <div key={label} className="flex items-baseline justify-between gap-4 py-4"><dt className="text-sm text-ink-secondary">{label}</dt><dd className="text-right font-mono text-sm tabular-nums">{value}</dd></div>)}
    </dl>

    {reservationDetailsReconciled && reservations.length > 0 ? <div className="mt-8">
      <h3 className="text-sm font-medium">Active reservations</h3>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {reservations.map((reservation) => <li key={reservation.id.toString()} className="flex items-baseline justify-between gap-4 py-3">
          <span className="font-mono text-xs" aria-label={`Reservation ${reservation.id.toString()}`}>R{reservation.id.toString()}</span>
          <span className="break-all text-right text-sm tabular-nums">{formatExactTokenAmount(reservation.quantity, releaseConfig.deliveryToken.decimals)} {releaseConfig.deliveryToken.symbol}<span className="mt-1 block text-xs text-ink-tertiary">{formatExactTokenAmount(reservation.lockedPayout, releaseConfig.settlementToken.decimals)} {releaseConfig.settlementToken.symbol} locked payout</span></span>
        </li>)}
      </ul>
    </div> : null}

    {quote ? <div className="mt-8">
      <h3 className="text-sm font-medium">Measured fill</h3>
      <dl className="mt-3 grid grid-cols-2 border-y border-line sm:grid-cols-4">
        {[
          ["From", quote.startPosition, releaseConfig.deliveryToken.decimals, releaseConfig.deliveryToken.symbol],
          ["To", quote.endPosition, releaseConfig.deliveryToken.decimals, releaseConfig.deliveryToken.symbol],
          ["Quantity", quote.quantity, releaseConfig.deliveryToken.decimals, releaseConfig.deliveryToken.symbol],
          ["Payout", quote.payout, releaseConfig.settlementToken.decimals, releaseConfig.settlementToken.symbol],
        ].map(([label, value, decimals, symbol]) => <div key={label as string} className="min-w-0 border-b border-line px-2 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><dt className="text-xs text-ink-tertiary">{label as string}</dt><dd className="mt-1 break-all font-mono text-xs tabular-nums">{formatExactTokenAmount(value as bigint, decimals as number)} {symbol as string}</dd></div>)}
      </dl>
    </div> : null}
  </section>;
}
