"use client";

import Link from "next/link";
import { InlineRecoveryMessage } from "@/components/states/InlineRecoveryMessage";
import { RouteNotFound } from "@/components/states/RouteNotFound";
import { ReceiptFactSchedule } from "./ReceiptFactSchedule";
import { ReceiptRelationship } from "./ReceiptRelationship";
import { ReceiptSkeleton } from "./ReceiptSkeleton";
import { ReceiptTechnicalDisclosure } from "./ReceiptTechnicalDisclosure";
import { useReceipt } from "./useReceipt";

export function ReceiptWorkspace({ reservationId }: { reservationId: string }) {
  const query = useReceipt(reservationId);
  if (query.isLoading) return <ReceiptSkeleton />;
  if (query.isError || !query.data)
    return <InlineRecoveryMessage title="We couldn't load this delivery receipt." message="The settlement is unchanged. Try rebuilding the receipt from confirmed data." onRetry={() => void query.refetch()} />;
  if (query.data.status === "not_found")
    return <RouteNotFound title="We couldn't find that delivery receipt." href="/activity" linkLabel="Back to activity" />;
  if (query.data.status === "pending")
    return (
      <section className="border-y border-line py-12">
        <h1 className="text-2xl font-medium">This delivery receipt isn&apos;t complete yet.</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-ink-secondary">A completed receipt is available after Creditcoin confirms settlement.</p>
        <Link href={`/solver/reservations/${reservationId}`} className="mt-6 inline-flex min-h-11 items-center text-sm underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal">View reservation workspace</Link>
      </section>
    );
  if (query.data.status === "rebuilding")
    return <InlineRecoveryMessage title="We're rebuilding this receipt from confirmed settlement data." message="The confirmed settlement is unchanged. Try again while the receipt projection is refreshed." onRetry={() => void query.refetch()} />;
  if (query.data.status === "inconsistent")
    return <InlineRecoveryMessage title="We're rebuilding this receipt from confirmed settlement data." message="A receipt detail did not match confirmed settlement data, so Successful is withheld while it is reconciled." onRetry={() => void query.refetch()} />;
  if (query.data.status === "unavailable")
    return <InlineRecoveryMessage title="We couldn't load this delivery receipt." message="The settlement is unchanged. Try rebuilding the receipt from confirmed data." onRetry={() => void query.refetch()} />;
  const receipt = query.data.receipt;
  return (
    <>
      <Link href="/activity" className="mb-6 inline-flex min-h-11 items-center text-sm text-ink-secondary underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal">Back to activity</Link>
      <header className="border-b border-line pb-8">
        <p className="font-mono text-xs text-ink-tertiary">Delivery receipt · R{receipt.reservationId}</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <h1 className="max-w-3xl text-[30px] leading-9 font-medium tracking-tight">Delivery verified. Payment released.</h1>
          <span className="border-l-2 border-success pl-3 text-sm font-medium uppercase tracking-wide">Successful</span>
        </div>
        <p className="mt-4 text-sm text-ink-secondary">Settled {new Intl.DateTimeFormat("en", { dateStyle: "long", timeStyle: "medium" }).format(new Date(receipt.settledAt))}</p>
      </header>
      <ReceiptRelationship receipt={receipt} />
      <ReceiptFactSchedule receipt={receipt} />
      <ReceiptTechnicalDisclosure receipt={receipt} />
    </>
  );
}
