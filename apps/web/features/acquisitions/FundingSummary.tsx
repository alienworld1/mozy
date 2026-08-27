import { releaseConfig } from "@mozy/chain-config";
import type { ParsedAcquisitionTerms } from "./types";
import { formatDateTime, formatDuration, formatTokenAmount } from "./format";

export function FundingSummary({ terms, preview, calculating, error }: { terms?: ParsedAcquisitionTerms; preview?: bigint; calculating: boolean; error?: string }) {
  return (
    <aside className="border-t-2 border-ink py-6 lg:sticky lg:top-8 lg:self-start" aria-label="Funding summary">
      <h2 className="text-lg font-medium">Funding summary</h2>
      <dl className="mt-6 divide-y divide-line border-y border-line text-sm">
        <div className="flex justify-between gap-4 py-3"><dt className="text-ink-secondary">Target</dt><dd className="text-right tabular-nums">{terms ? `${formatTokenAmount(terms.targetAmount, releaseConfig.deliveryToken.decimals)} TEST` : "—"}</dd></div>
        <div className="py-4"><dt className="text-ink-secondary">Maximum budget</dt><dd className="mt-2 text-right text-2xl font-medium tabular-nums">{preview !== undefined ? `${formatTokenAmount(preview, releaseConfig.settlementToken.decimals)} BTKT` : "—"}</dd>{calculating ? <p className="mt-2 text-right text-xs text-pending" aria-live="polite">Calculating maximum budget…</p> : null}{error ? <p className="mt-2 text-xs text-error" role="alert">{error}</p> : null}</div>
        <div className="flex justify-between gap-4 py-3"><dt className="text-ink-secondary">Delivery</dt><dd className="text-right">{releaseConfig.foreign.name}</dd></div>
        <div className="flex justify-between gap-4 py-3"><dt className="text-ink-secondary">Settlement</dt><dd className="text-right">{releaseConfig.creditcoin.name}</dd></div>
        <div className="py-3"><dt className="text-ink-secondary">Delivery wallet</dt><dd className="mt-1 break-all font-mono text-xs">{terms?.deliveryWallet ?? "—"}</dd></div>
        <div className="flex justify-between gap-4 py-3"><dt className="text-ink-secondary">Expiry</dt><dd className="text-right">{terms ? formatDateTime(terms.mandateExpiry) : "—"}</dd></div>
        <div className="flex justify-between gap-4 py-3"><dt className="text-ink-secondary">Reservation duration</dt><dd>{terms ? formatDuration(terms.reservationDuration) : "—"}</dd></div>
      </dl>
      <p className="mt-4 text-sm leading-6 text-ink-secondary">Your acquisition opens when the full maximum budget is funded.</p>
    </aside>
  );
}
