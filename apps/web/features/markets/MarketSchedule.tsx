"use client";

import Link from "next/link";
import { releaseConfig } from "@mozy/chain-config";
import { EmptyState } from "@/components/states/EmptyState";
import { InlineRecoveryMessage } from "@/components/states/InlineRecoveryMessage";
import { StructuralSkeleton } from "@/components/states/StructuralSkeleton";
import {
  formatDateTime,
  formatDuration,
  formatTokenAmount,
} from "@/features/acquisitions/format";
import { useOpenMarkets } from "./useOpenMarkets";

export function MarketSchedule() {
  const query = useOpenMarkets();
  if (query.isLoading) return <StructuralSkeleton />;
  if (query.isError)
    return (
      <InlineRecoveryMessage
        title="Markets are unavailable."
        message="We couldn’t refresh Creditcoin state."
        onRetry={() => void query.refetch()}
      />
    );
  if (!query.data?.length)
    return (
      <EmptyState
        message="No open acquisitions yet."
        supporting="Funded acquisitions will appear here when they are ready for reservation."
      />
    );

  return (
    <section
      className="mt-10 border-t border-line"
      aria-label="Open acquisition schedule"
    >
      <div className="hidden min-h-11 grid-cols-[0.55fr_1fr_0.9fr_1fr_1fr_auto] items-center gap-4 border-b border-line font-mono text-[10px] tracking-wide text-ink-tertiary lg:grid">
        <span>REFERENCE</span>
        <span>DELIVERY</span>
        <span>OPEN</span>
        <span>INDICATION</span>
        <span>WINDOW / EXPIRY</span>
        <span>ACTION</span>
      </div>
      <ul>
        {query.data.map(
          ({ acquisition, openAmount, indicationQuantity, indication }) => {
            const mandate = acquisition.mandate;
            return (
              <li
                key={mandate.id.toString()}
                className="grid gap-5 border-b border-line py-6 lg:grid-cols-[0.55fr_1fr_0.9fr_1fr_1fr_auto] lg:items-center lg:gap-4"
              >
                <div>
                  <span className="font-mono text-xs text-ink-tertiary lg:hidden">
                    REFERENCE{" "}
                  </span>
                  <span className="font-mono text-sm">
                    M{mandate.id.toString()}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-ink-tertiary lg:hidden">
                    DELIVERY
                  </span>
                  <span className="text-sm">
                    {releaseConfig.deliveryToken.symbol}
                  </span>
                  <span className="block text-xs text-ink-secondary">
                    {releaseConfig.foreign.name}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-ink-tertiary lg:hidden">
                    OPEN
                  </span>
                  <span className="font-mono text-sm tabular-nums">
                    {formatTokenAmount(
                      openAmount,
                      releaseConfig.deliveryToken.decimals,
                    )}{" "}
                    {releaseConfig.deliveryToken.symbol}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-ink-tertiary lg:hidden">
                    CURRENT INDICATION
                  </span>
                  <span className="font-mono text-sm tabular-nums">
                    {formatTokenAmount(
                      indication.payout,
                      releaseConfig.settlementToken.decimals,
                    )}{" "}
                    {releaseConfig.settlementToken.symbol}
                  </span>
                  <span className="block text-xs text-ink-secondary">
                    for{" "}
                    {formatTokenAmount(
                      indicationQuantity,
                      releaseConfig.deliveryToken.decimals,
                    )}{" "}
                    {releaseConfig.deliveryToken.symbol} ·{" "}
                    {releaseConfig.creditcoin.name}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-ink-tertiary lg:hidden">
                    WINDOW / EXPIRY
                  </span>
                  <span className="text-sm">
                    {formatDuration(mandate.reservationDuration)}
                  </span>
                  <span className="block text-xs text-ink-secondary">
                    Expires {formatDateTime(mandate.mandateExpiry)}
                  </span>
                </div>
                <Link
                  href={`/markets/${mandate.id.toString()}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-control bg-signal px-4 text-sm font-medium text-paper-raised outline-none hover:bg-signal-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
                >
                  Inspect acquisition
                </Link>
              </li>
            );
          },
        )}
      </ul>
    </section>
  );
}
