"use client";

import { releaseConfig } from "@mozy/chain-config";
import { ChangedAcquisitionError } from "./useFillQuote";
import { formatExactTokenAmount } from "../format";
import type { FillQuote } from "../types";
import type { MeasurementValidation } from "./instrument-model";

export function FillMeasurement({
  input,
  onInputChange,
  validation,
  quote,
  quoteError,
  quoteLoading,
  enabled,
  disabledMessage,
  onRetry,
}: {
  input: string;
  onInputChange: (value: string) => void;
  validation: MeasurementValidation;
  quote?: FillQuote;
  quoteError: Error | null;
  quoteLoading: boolean;
  enabled: boolean;
  disabledMessage?: string;
  onRetry: () => unknown;
}) {
  const validationMessage = validation.status === "invalid" ? validation.message : undefined;
  const quoteMessage = quoteError instanceof ChangedAcquisitionError
    ? "This acquisition changed. Review the latest open amount."
    : quoteError
      ? "We couldn't calculate this fill. Check the connection and try again."
      : undefined;
  const describedBy = ["fill-helper", validationMessage ? "fill-error" : undefined, quoteMessage ? "quote-error" : undefined]
    .filter(Boolean)
    .join(" ");

  return (
    <aside className="border-t border-line pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8" aria-labelledby="measure-fill-heading">
      <div className="flex items-baseline justify-between gap-4">
        <h3 id="measure-fill-heading" className="text-lg font-medium">Measure a fill</h3>
        <span className="font-mono text-xs text-ink-tertiary">{releaseConfig.deliveryToken.symbol}</span>
      </div>
      <label htmlFor="fill-quantity" className="mt-6 block text-sm font-medium">Quantity</label>
      <div className="mt-2 flex min-h-12 items-center border border-line-strong bg-paper-raised focus-within:border-signal">
        <input
          id="fill-quantity"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={input}
          disabled={!enabled}
          onChange={(event) => onInputChange(event.target.value)}
          aria-invalid={validationMessage ? true : undefined}
          aria-describedby={describedBy}
          className="min-w-0 flex-1 bg-transparent px-3 py-3 text-lg tabular-nums outline-none disabled:text-ink-tertiary"
          placeholder="0"
        />
        <span className="pr-3 text-sm text-ink-tertiary" aria-hidden="true">{releaseConfig.deliveryToken.symbol}</span>
      </div>
      <p id="fill-helper" className="mt-3 text-sm leading-5 text-ink-secondary">
        {disabledMessage ?? "Enter an amount to see the exact current payout."}
      </p>

      {validationMessage ? <p id="fill-error" className="mt-3 border-l-2 border-error pl-3 text-sm text-error" role="alert">{validationMessage}</p> : null}
      {quoteLoading ? <p className="mt-4 font-mono text-xs text-ink-secondary" role="status">Calculating the current payout…</p> : null}
      {quoteMessage ? <div id="quote-error" className="mt-4 border-l-2 border-error pl-3" role="alert">
        <p className="text-sm leading-5 text-error">{quoteMessage}</p>
        {quoteError instanceof ChangedAcquisitionError ? null : <button type="button" onClick={() => void onRetry()} className="mt-2 min-h-11 text-sm font-medium underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal">Try again</button>}
      </div> : null}

      {quote && !quoteLoading ? <dl className="mt-6 divide-y divide-line border-y border-line">
        {[
          ["From", quote.startPosition, releaseConfig.deliveryToken.decimals, releaseConfig.deliveryToken.symbol],
          ["To", quote.endPosition, releaseConfig.deliveryToken.decimals, releaseConfig.deliveryToken.symbol],
          ["Quantity", quote.quantity, releaseConfig.deliveryToken.decimals, releaseConfig.deliveryToken.symbol],
          ["Payout", quote.payout, releaseConfig.settlementToken.decimals, releaseConfig.settlementToken.symbol],
        ].map(([label, value, decimals, symbol]) => <div key={label as string} className="flex items-baseline justify-between gap-3 py-3">
          <dt className="text-xs text-ink-secondary">{label as string}</dt>
          <dd className="break-all text-right font-mono text-sm tabular-nums">{formatExactTokenAmount(value as bigint, decimals as number)} <span className="text-xs text-ink-tertiary">{symbol as string}</span></dd>
        </div>)}
      </dl> : null}
      {quote ? <p className="mt-4 text-xs leading-5 text-ink-tertiary">This measurement reflects the current contract state. It is not reserved or locked.</p> : null}
    </aside>
  );
}
