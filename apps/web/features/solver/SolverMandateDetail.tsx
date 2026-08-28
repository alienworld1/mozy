"use client";

import { releaseConfig } from "@mozy/chain-config";
import Link from "next/link";
import { useCallback } from "react";
import { getAddress } from "viem";
import { InlineRecoveryMessage } from "@/components/states/InlineRecoveryMessage";
import { StructuralSkeleton } from "@/components/states/StructuralSkeleton";
import { formatDateTime } from "@/features/acquisitions/format";
import { buildInstrumentModel } from "@/features/acquisitions/instrument/instrument-model";
import { useAcquisitionSnapshot } from "@/features/acquisitions/instrument/useAcquisitionSnapshot";
import { useMandateReservations } from "@/features/acquisitions/instrument/useMandateReservations";
import { mandateStatuses } from "@/features/acquisitions/types";
import { useAcquisition } from "@/features/acquisitions/useAcquisition";
import { SolverMandateDetailContent } from "./SolverMandateDetailContent";

export function SolverMandateDetail({ mandateId }: { mandateId: string }) {
  const parsedId = BigInt(mandateId);
  const snapshot = useAcquisitionSnapshot(parsedId);
  const acquisition = useAcquisition(parsedId, snapshot.data);
  const reservations = useMandateReservations({
    mandateId: parsedId,
    snapshotBlock: snapshot.data,
  });
  const refresh = useCallback(async () => {
    const next = await snapshot.refetch();
    if (next.data === snapshot.data)
      await Promise.all([acquisition.refetch(), reservations.refetch()]);
  }, [acquisition, reservations, snapshot]);
  if (snapshot.isLoading || acquisition.isLoading)
    return <StructuralSkeleton variant="instrument" />;
  if (
    snapshot.isError ||
    acquisition.isError ||
    !acquisition.data ||
    acquisition.data.mandate.id === 0n
  )
    return (
      <InlineRecoveryMessage
        title="We couldn’t find that acquisition."
        message="The mandate ID does not exist in the current Creditcoin deployment."
        onRetry={() => void refresh()}
      />
    );
  const { mandate, account } = acquisition.data;
  const accountingVerified =
    mandate.marketId === BigInt(releaseConfig.marketId) &&
    getAddress(account.token) === releaseConfig.settlementToken.address &&
    mandate.acquiredAmount + mandate.reservedAmount <= mandate.targetAmount &&
    account.funded === mandate.requiredFunding &&
    account.funded ===
      account.spent + account.reserved + account.free + account.refunded;
  const model = buildInstrumentModel(
    mandate,
    acquisition.data.snapshotBlock ?? 0n,
  );
  if (!model)
    return (
      <InlineRecoveryMessage
        title="This acquisition’s terms are unavailable."
        message="We couldn’t verify its quantity structure from Creditcoin."
        onRetry={() => void refresh()}
      />
    );
  return (
    <>
      <Link
        href="/markets"
        className="mb-6 inline-flex min-h-11 items-center text-sm text-ink-secondary underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal"
      >
        Back to markets
      </Link>
      <header className="border-b border-line pb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs text-ink-tertiary">
              MANDATE M{mandate.id.toString()}
            </p>
            <h1 className="mt-2 text-[30px] leading-9 font-medium tracking-tight">
              Reserve acquisition M{mandate.id.toString()}
            </h1>
          </div>
          <span className="border-l-2 border-signal pl-3 text-sm font-medium uppercase tracking-wide">
            {mandateStatuses[mandate.status] ?? "Unknown"}
          </span>
        </div>
        <p className="mt-4 text-[15px] text-ink-secondary">
          {releaseConfig.deliveryToken.symbol} on {releaseConfig.foreign.name} ·
          funded in {releaseConfig.settlementToken.symbol} on{" "}
          {releaseConfig.creditcoin.name}
        </p>
        <p className="mt-2 text-sm text-ink-tertiary">
          Expires {formatDateTime(mandate.mandateExpiry)}
        </p>
      </header>
      <SolverMandateDetailContent
        acquisition={acquisition.data}
        model={model}
        accountingVerified={accountingVerified}
        onRefresh={refresh}
        reservationDetails={reservations.data}
        reservationDetailsLoading={reservations.isFetching}
        reservationDetailsError={reservations.isError}
        onRetryReservations={async () => {
          await reservations.refetch();
        }}
      />
    </>
  );
}
