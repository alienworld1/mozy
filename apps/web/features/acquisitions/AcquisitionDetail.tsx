"use client";

import Link from "next/link";
import { releaseConfig } from "@mozy/chain-config";
import { InlineRecoveryMessage } from "@/components/states/InlineRecoveryMessage";
import { StructuralSkeleton } from "@/components/states/StructuralSkeleton";
import { BudgetSchedule } from "./BudgetSchedule";
import { formatDateTime } from "./format";
import { LifecycleControls } from "./LifecycleControls";
import { mandateStatuses } from "./types";
import { QuantitySchedule } from "./QuantitySchedule";
import { TechnicalDisclosure } from "./TechnicalDisclosure";
import { TermsSchedule } from "./TermsSchedule";
import { useAcquisition } from "./useAcquisition";

export function AcquisitionDetail({ mandateId }: { mandateId: string }) {
  const query = useAcquisition(BigInt(mandateId));
  if (query.isLoading) return <StructuralSkeleton />;
  if (query.isError || !query.data || query.data.mandate.id === 0n) return <InlineRecoveryMessage title="We couldn’t find that acquisition." message="The mandate ID does not exist in the current Creditcoin deployment." onRetry={() => void query.refetch()} />;
  const { mandate, account } = query.data;
  const quantityVerified = mandate.acquiredAmount + mandate.reservedAmount <= mandate.targetAmount;
  const budgetVerified = account.funded === account.spent + account.reserved + account.free + account.refunded && account.funded <= mandate.requiredFunding;
  const status = mandateStatuses[mandate.status] ?? "Unknown";
  return <>
    <Link href="/acquisitions" className="mb-6 inline-flex min-h-11 items-center text-sm text-ink-secondary underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal">Back to acquisitions</Link>
    <header className="border-b border-line pb-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-mono text-xs text-ink-tertiary">MANDATE M{mandate.id.toString()}</p><h1 className="mt-2 text-[30px] leading-9 font-medium tracking-tight">Acquisition M{mandate.id.toString()}</h1></div><span className="border-l-2 border-signal pl-3 text-sm font-medium uppercase tracking-wide">{status}</span></div><p className="mt-4 text-[15px] text-ink-secondary">TEST on {releaseConfig.foreign.name} · funded in BTKT on {releaseConfig.creditcoin.name}</p><p className="mt-2 text-sm text-ink-tertiary">Expires {formatDateTime(mandate.mandateExpiry)}</p></header>
    <div className="mt-12 grid gap-12 lg:grid-cols-2"><QuantitySchedule mandate={mandate} /><BudgetSchedule mandate={mandate} account={account} /></div>
    <TermsSchedule mandate={mandate} />
    {!quantityVerified || !budgetVerified ? <p className="mt-8 border-l-2 border-error pl-4 text-sm text-error">This acquisition’s accounting could not be verified. Refresh before continuing.</p> : null}
    <LifecycleControls acquisition={query.data} accountingVerified={quantityVerified && budgetVerified} onRefresh={query.refetch} />
    <TechnicalDisclosure mandate={mandate} />
  </>;
}
