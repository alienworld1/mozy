"use client";

import { releaseConfig } from "@mozy/chain-config";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAddress } from "viem";
import { useConnection, useSwitchChain } from "wagmi";
import { DisabledAction } from "@/components/states/DisabledAction";
import { RequiredNetworkMessage } from "@/components/wallet/RequiredNetworkMessage";
import { TransactionState } from "@/components/states/TransactionState";
import {
  formatDateTime,
  formatDuration,
  formatTokenAmount,
} from "@/features/acquisitions/format";
import type { ReservationQuote } from "@/features/acquisitions/types";
import { classifyWalletError } from "@/lib/wallet-errors";
import { useBondReadiness } from "./useBondReadiness";
import { useReservationTransaction } from "./useReservationTransaction";

export function ReservationTerms({
  mandateId,
  quote,
  quoteLoading,
  quoteError,
  onRefresh,
}: {
  mandateId: bigint;
  quote?: ReservationQuote;
  quoteLoading: boolean;
  quoteError: boolean;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const connection = useConnection();
  const { switchChainAsync } = useSwitchChain();
  const [switching, setSwitching] = useState(false);
  const [switchMessage, setSwitchMessage] = useState<string>();
  const readiness = useBondReadiness(
    connection.address ? getAddress(connection.address) : undefined,
    !!quote,
  );
  const transaction = useReservationTransaction(mandateId);
  const amount = quote
    ? formatTokenAmount(quote.quantity, releaseConfig.deliveryToken.decimals)
    : undefined;
  const bond = quote
    ? formatTokenAmount(
        quote.bondAmount,
        releaseConfig.settlementToken.decimals,
      )
    : undefined;
  const allowanceSufficient =
    !!quote && !!readiness.data && readiness.data.allowance >= quote.bondAmount;
  const balanceSufficient =
    !!quote && !!readiness.data && readiness.data.balance >= quote.bondAmount;
  const connected = connection.status === "connected" && !!connection.address;
  const rightNetwork = connection.chainId === releaseConfig.creditcoin.id;

  async function switchToCreditcoin() {
    setSwitching(true);
    setSwitchMessage(undefined);
    try {
      await switchChainAsync({ chainId: releaseConfig.creditcoin.id });
    } catch (error) {
      setSwitchMessage(
        classifyWalletError(error) === "user_rejected"
          ? "Network switch cancelled. Your measurement is unchanged."
          : `Switch your wallet to ${releaseConfig.creditcoin.name}, then try again.`,
      );
    } finally {
      setSwitching(false);
    }
  }

  async function run(action: "approve" | "reserve") {
    if (!quote) return;
    const reservationId = await transaction.run(action, quote);
    if (reservationId !== undefined)
      router.push(`/solver/reservations/${reservationId.toString()}`);
    else if (action === "approve") void readiness.refetch();
    onRefresh();
  }

  return (
    <section
      className="border-t border-line pt-8 lg:border-t-0 lg:border-l lg:pl-8"
      aria-labelledby="reservation-terms-title"
    >
      <p className="font-mono text-[10px] tracking-wide text-ink-tertiary">
        EXECUTABLE TERMS
      </p>
      <h2 id="reservation-terms-title" className="mt-2 text-xl font-medium">
        Reserve this fill
      </h2>
      {!quote && !quoteLoading && !quoteError ? (
        <p className="mt-5 text-sm leading-6 text-ink-secondary">
          Measure a valid fill to see the exact reservation commitment.
        </p>
      ) : null}
      {quoteLoading ? (
        <p className="mt-5 text-sm text-ink-secondary" role="status">
          Refreshing the canonical reservation quote…
        </p>
      ) : null}
      {quoteError ? (
        <div className="mt-5 border-l-2 border-error pl-4" role="alert">
          <p className="text-sm text-ink-secondary">
            This acquisition changed. Review the latest open amount and payout.
          </p>
          <button
            type="button"
            onClick={onRefresh}
            className="mt-2 min-h-11 text-sm font-medium underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal"
          >
            Refresh terms
          </button>
        </div>
      ) : null}
      {quote ? (
        <>
          <dl className="mt-6 divide-y divide-line border-y border-line">
            <div className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-4 py-3">
              <dt className="text-xs text-ink-tertiary">Deliver</dt>
              <dd className="break-all text-right font-mono text-sm tabular-nums">
                {amount} {releaseConfig.deliveryToken.symbol}
              </dd>
            </div>
            <div className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-4 py-3">
              <dt className="text-xs text-ink-tertiary">Interval</dt>
              <dd className="break-all text-right font-mono text-xs">
                {formatTokenAmount(
                  quote.startPosition,
                  releaseConfig.deliveryToken.decimals,
                )}
                –
                {formatTokenAmount(
                  quote.endPosition,
                  releaseConfig.deliveryToken.decimals,
                )}{" "}
                {releaseConfig.deliveryToken.symbol}
              </dd>
            </div>
            <div className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-4 py-3">
              <dt className="text-xs text-ink-tertiary">Receive</dt>
              <dd className="break-all text-right font-mono text-sm tabular-nums">
                {formatTokenAmount(
                  quote.payout,
                  releaseConfig.settlementToken.decimals,
                )}{" "}
                {releaseConfig.settlementToken.symbol}
              </dd>
            </div>
            <div className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-4 py-3">
              <dt className="text-xs text-ink-tertiary">Reservation bond</dt>
              <dd className="break-all text-right font-mono text-sm tabular-nums">
                {bond} {releaseConfig.settlementToken.symbol}
              </dd>
            </div>
            <div className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-4 py-3">
              <dt className="text-xs text-ink-tertiary">Token contract</dt>
              <dd
                className="truncate text-right font-mono text-xs"
                title={quote.foreignToken}
              >
                {quote.foreignToken}
              </dd>
            </div>
            <div className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-4 py-3">
              <dt className="text-xs text-ink-tertiary">To</dt>
              <dd
                className="truncate text-right font-mono text-xs"
                title={quote.deliveryWallet}
              >
                {quote.deliveryWallet}
              </dd>
            </div>
            <div className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-4 py-3">
              <dt className="text-xs text-ink-tertiary">On</dt>
              <dd className="text-right text-sm">
                {releaseConfig.foreign.name}
              </dd>
            </div>
            <div className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-4 py-3">
              <dt className="text-xs text-ink-tertiary">Settlement</dt>
              <dd className="text-right text-sm">
                {releaseConfig.settlementToken.symbol} ·{" "}
                {releaseConfig.creditcoin.name}
              </dd>
            </div>
            <div className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-4 py-3">
              <dt className="text-xs text-ink-tertiary">Delivery window</dt>
              <dd className="text-right text-sm">
                {formatDuration(quote.reservationDuration)}
              </dd>
            </div>
            <div className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-4 py-3">
              <dt className="text-xs text-ink-tertiary">Estimated deadline</dt>
              <dd className="text-right text-sm">
                About{" "}
                {formatDateTime(
                  quote.quotedAtTimestamp + quote.reservationDuration,
                )}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-5 text-ink-secondary">
            Current quote. Payout locks only when the reservation confirms. The
            exact deadline is set on Creditcoin after confirmation.
          </p>
          {connected ? (
            <p className="mt-4 text-xs leading-5 text-ink-secondary">
              Reserved solver and required sender:{" "}
              <span className="font-mono" title={connection.address}>
                {connection.address}
              </span>
            </p>
          ) : null}
          {!connected ? (
            <DisabledAction reason="Connect your wallet to reserve this fill.">
              Connect wallet to reserve
            </DisabledAction>
          ) : null}
          {connected && !rightNetwork ? (
            <div className="mt-6">
              <RequiredNetworkMessage
                requiredChainId={releaseConfig.creditcoin.id}
                currentChainId={connection.chainId}
                switching={switching}
                onSwitch={() => void switchToCreditcoin()}
              />
              {switchMessage ? (
                <p className="mt-3 text-sm text-error" role="alert">
                  {switchMessage}
                </p>
              ) : null}
            </div>
          ) : null}
          {connected && rightNetwork && readiness.isLoading ? (
            <p className="mt-6 text-sm text-ink-secondary" role="status">
              Checking BTKT bond readiness…
            </p>
          ) : null}
          {connected && rightNetwork && readiness.isError ? (
            <button
              type="button"
              onClick={() => void readiness.refetch()}
              className="mt-6 min-h-11 rounded-control border border-line-strong px-4 text-sm font-medium outline-none focus-visible:outline-2 focus-visible:outline-signal"
            >
              Retry bond check
            </button>
          ) : null}
          {connected && rightNetwork && readiness.data && !balanceSufficient ? (
            <div className="mt-6">
              <DisabledAction reason={`This wallet needs at least ${bond} ${releaseConfig.settlementToken.symbol} for the reservation bond.`}>Reserve fill</DisabledAction>
              <Link href="/test-funds" className="mt-2 inline-flex min-h-11 items-center text-xs font-medium underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal">Get demo funds</Link>
            </div>
          ) : null}
          {connected &&
          rightNetwork &&
          readiness.data &&
          balanceSufficient &&
          !allowanceSufficient ? (
            <div className="mt-6">
              <button
                type="button"
                disabled={transaction.pending || quoteLoading}
                onClick={() => void run("approve")}
                className="min-h-11 w-full rounded-control bg-signal px-4 text-sm font-medium text-paper-raised outline-none hover:bg-signal-strong disabled:cursor-wait disabled:bg-line-emphasis focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
              >
                Approve {bond} {releaseConfig.settlementToken.symbol}
              </button>
              <p className="mt-2 text-xs leading-5 text-ink-secondary">
                Approval does not create a reservation.
              </p>
            </div>
          ) : null}
          {connected &&
          rightNetwork &&
          readiness.data &&
          balanceSufficient &&
          allowanceSufficient ? (
            <div className="mt-6">
              <button
                type="button"
                disabled={transaction.pending || quoteLoading}
                onClick={() => void run("reserve")}
                className="min-h-11 w-full rounded-control bg-signal px-4 text-sm font-medium text-paper-raised outline-none hover:bg-signal-strong disabled:cursor-wait disabled:bg-line-emphasis focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
              >
                Reserve {amount} {releaseConfig.deliveryToken.symbol}
              </button>
              <p className="mt-2 text-xs leading-5 text-ink-secondary">
                Payout and quantity lock after confirmation on Creditcoin.
              </p>
            </div>
          ) : null}
          <div className="mt-6">
            <TransactionState
              phase={transaction.phase}
              chainId={releaseConfig.creditcoin.id}
              transactionHash={transaction.hash}
              message={transaction.message}
            />
          </div>
        </>
      ) : null}
    </section>
  );
}
