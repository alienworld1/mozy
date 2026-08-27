"use client";

import Link from "next/link";
import { releaseConfig } from "@mozy/chain-config";
import { useCallback } from "react";
import { InlineRecoveryMessage } from "@/components/states/InlineRecoveryMessage";
import { StructuralSkeleton } from "@/components/states/StructuralSkeleton";
import { AcquisitionDetailContent } from "./AcquisitionDetailContent";
import { BudgetSchedule } from "./BudgetSchedule";
import { formatDateTime } from "./format";
import { LifecycleControls } from "./LifecycleControls";
import { buildInstrumentModel } from "./instrument/instrument-model";
import { useAcquisitionSnapshot } from "./instrument/useAcquisitionSnapshot";
import { useMandateReservations } from "./instrument/useMandateReservations";
import { mandateStatuses } from "./types";
import { TechnicalDisclosure } from "./TechnicalDisclosure";
import { TermsSchedule } from "./TermsSchedule";
import { useAcquisition } from "./useAcquisition";

export function AcquisitionDetail({ mandateId }: { mandateId: string }) {
  const parsedMandateId = BigInt(mandateId);
  const snapshotQuery = useAcquisitionSnapshot(parsedMandateId);
  const query = useAcquisition(parsedMandateId, snapshotQuery.data);
  const reservationQuery = useMandateReservations({ mandateId: parsedMandateId, snapshotBlock: snapshotQuery.data });
  const refetchSnapshot = snapshotQuery.refetch;
  const refetchAcquisition = query.refetch;
  const refetchReservations = reservationQuery.refetch;
  const refresh = useCallback(async () => {
    const snapshot = await refetchSnapshot();
    if (snapshot.data === snapshotQuery.data) await Promise.all([refetchAcquisition(), refetchReservations()]);
  }, [refetchAcquisition, refetchReservations, refetchSnapshot, snapshotQuery.data]);
  if (snapshotQuery.isLoading || query.isLoading) return <StructuralSkeleton variant="instrument" />;
  if (snapshotQuery.isError || query.isError || !query.data || query.data.mandate.id === 0n) return <InlineRecoveryMessage title="We couldn’t find that acquisition." message="The mandate ID does not exist in the current Creditcoin deployment." onRetry={() => void refresh()} />;
  const { mandate, account } = query.data;
  const quantityVerified = mandate.acquiredAmount + mandate.reservedAmount <= mandate.targetAmount;
  const budgetVerified = account.funded === account.spent + account.reserved + account.free + account.refunded && account.funded <= mandate.requiredFunding;
  const accountingVerified = quantityVerified && budgetVerified;
  const model = buildInstrumentModel(mandate, query.data.snapshotBlock ?? 0n);
  const status = mandateStatuses[mandate.status] ?? "Unknown";
  return <>
    <Link href="/acquisitions" className="mb-6 inline-flex min-h-11 items-center text-sm text-ink-secondary underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal">Back to acquisitions</Link>
    <header className="border-b border-line pb-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-mono text-xs text-ink-tertiary">MANDATE M{mandate.id.toString()}</p><h1 className="mt-2 text-[30px] leading-9 font-medium tracking-tight">Acquisition M{mandate.id.toString()}</h1></div><span className="border-l-2 border-signal pl-3 text-sm font-medium uppercase tracking-wide">{status}</span></div><p className="mt-4 text-[15px] text-ink-secondary">TEST on {releaseConfig.foreign.name} · funded in BTKT on {releaseConfig.creditcoin.name}</p><p className="mt-2 text-sm text-ink-tertiary">Expires {formatDateTime(mandate.mandateExpiry)}</p></header>
    {model ? <AcquisitionDetailContent acquisition={query.data} model={model} accountingVerified={accountingVerified} onRefresh={refresh} reservationDetails={reservationQuery.data} reservationDetailsLoading={reservationQuery.isFetching} reservationDetailsError={reservationQuery.isError} onRetryReservations={async () => { await refetchReservations(); }} /> : <>
      <p className="mt-10 border-y border-error py-6 text-sm text-error">This acquisition&apos;s terms could not be verified. Refresh before continuing.</p>
      <div className="mt-12"><BudgetSchedule mandate={mandate} account={account} /></div>
      <TermsSchedule mandate={mandate} />
      <LifecycleControls acquisition={query.data} accountingVerified={false} onRefresh={refresh} />
      <TechnicalDisclosure mandate={mandate} />
    </>}
  </>;
}
