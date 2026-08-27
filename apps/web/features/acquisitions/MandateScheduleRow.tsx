import Link from "next/link";
import { releaseConfig } from "@mozy/chain-config";
import { formatDateTime, formatTokenAmount } from "./format";
import { mandateStatuses, type Acquisition } from "./types";

export function MandateScheduleRow({ acquisition }: { acquisition: Acquisition }) {
  const { mandate, account } = acquisition;
  const open = mandate.targetAmount - mandate.acquiredAmount - mandate.reservedAmount;
  const status = mandate.status === 1 && mandate.acquiredAmount > 0n ? "Partially filled" : mandateStatuses[mandate.status] ?? "Unknown";
  return (
    <article className="grid gap-5 border-b border-line py-6 md:grid-cols-[1.1fr_1fr_1fr_auto] md:items-center">
      <div><p className="font-mono text-xs text-ink-tertiary">M{mandate.id.toString()}</p><h3 className="mt-1 font-medium">{formatTokenAmount(mandate.targetAmount, releaseConfig.deliveryToken.decimals)} TEST target</h3><p className="mt-1 text-sm text-ink-secondary">{status}</p></div>
      <div className="text-sm"><p className="text-ink-tertiary">Quantity</p><p className="mt-1 tabular-nums">{formatTokenAmount(mandate.acquiredAmount, releaseConfig.deliveryToken.decimals)} acquired · {formatTokenAmount(open, releaseConfig.deliveryToken.decimals)} open</p></div>
      <div className="text-sm"><p className="text-ink-tertiary">Funding</p><p className="mt-1 tabular-nums">{formatTokenAmount(account.funded, releaseConfig.settlementToken.decimals)} / {formatTokenAmount(mandate.requiredFunding, releaseConfig.settlementToken.decimals)} BTKT</p><p className="mt-1 text-xs text-ink-tertiary">Expires {formatDateTime(mandate.mandateExpiry)}</p></div>
      <Link href={`/acquisitions/${mandate.id}`} className="inline-flex min-h-11 items-center justify-center rounded-control border border-line-strong px-4 text-sm font-medium outline-none hover:bg-wash focus-visible:outline-2 focus-visible:outline-signal">{mandate.status === 0 ? "Continue funding" : "View acquisition"}</Link>
    </article>
  );
}
