import { releaseConfig } from "@mozy/chain-config";
import { formatTokenAmount } from "./format";
import type { Mandate } from "./types";

export function QuantitySchedule({ mandate }: { mandate: Mandate }) {
  const values = [["Target", mandate.targetAmount], ["Acquired", mandate.acquiredAmount], ["Reserved", mandate.reservedAmount], ["Open", mandate.targetAmount - mandate.acquiredAmount - mandate.reservedAmount]] as const;
  return <section><h2 className="text-lg font-medium">Quantity schedule</h2><dl className="mt-4 divide-y divide-line border-y border-line">{values.map(([label, value]) => <div key={label} className="flex items-baseline justify-between gap-4 py-4"><dt className="text-sm text-ink-secondary">{label}</dt><dd className="text-xl font-medium tabular-nums">{formatTokenAmount(value, releaseConfig.deliveryToken.decimals)} <span className="text-sm font-normal text-ink-tertiary">TEST</span></dd></div>)}</dl></section>;
}
