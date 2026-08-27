import { releaseConfig } from "@mozy/chain-config";
import { formatTokenAmount } from "./format";
import type { Mandate, VaultAccount } from "./types";

export function BudgetSchedule({ mandate, account }: { mandate: Mandate; account: VaultAccount }) {
  const values = [["Maximum budget", mandate.requiredFunding], ["Funded", account.funded], ["Spent", account.spent], ["Reserved", account.reserved], ["Free to reclaim", account.free], ["Refunded", account.refunded]] as const;
  const average = mandate.acquiredAmount > 0n ? account.spent * 10n ** BigInt(releaseConfig.deliveryToken.decimals) / mandate.acquiredAmount : undefined;
  return <section><h2 className="text-lg font-medium">Budget schedule</h2><dl className="mt-4 divide-y divide-line border-y border-line">{values.map(([label, value]) => <div key={label} className="flex items-baseline justify-between gap-4 py-4"><dt className="text-sm text-ink-secondary">{label}</dt><dd className="text-xl font-medium tabular-nums">{formatTokenAmount(value, releaseConfig.settlementToken.decimals)} <span className="text-sm font-normal text-ink-tertiary">BTKT</span></dd></div>)}<div className="py-4"><div className="flex items-baseline justify-between gap-4"><dt className="text-sm text-ink-secondary">Average settled price</dt><dd className="text-xl font-medium tabular-nums">{average === undefined ? "—" : `${formatTokenAmount(average, releaseConfig.settlementToken.decimals)} BTKT / TEST`}</dd></div>{average === undefined ? <p className="mt-2 text-right text-xs text-ink-tertiary">Available after the first settled fill.</p> : null}</div></dl></section>;
}
