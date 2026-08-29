"use client";

import { releaseConfig } from "@mozy/chain-config";
import { useState } from "react";
import { useConnection, useSwitchChain } from "wagmi";
import { TransactionState } from "@/components/states/TransactionState";
import { RequiredNetworkMessage } from "@/components/wallet/RequiredNetworkMessage";
import { formatTokenAmount } from "@/features/acquisitions/format";
import { classifyWalletError } from "@/lib/wallet-errors";
import type { ReservationWorkspaceData } from "./useReservationWorkspace";
import { useExpireReservation } from "./useExpireReservation";

export function ReservationRecovery({ data, onRefresh }: { data: ReservationWorkspaceData; onRefresh: () => void }) {
  const connection = useConnection();
  const { switchChainAsync } = useSwitchChain();
  const [switching, setSwitching] = useState(false);
  const [switchMessage, setSwitchMessage] = useState<string>();
  const transaction = useExpireReservation(data.reservation.id, onRefresh);
  const active = data.reservation.status === 0;
  const eligible = data.expiryReadiness === "eligible";
  const wrongChain = connection.chainId !== releaseConfig.creditcoin.id;
  const quantity = formatTokenAmount(data.reservation.quantity, releaseConfig.deliveryToken.decimals);
  const payout = formatTokenAmount(data.reservation.lockedPayout, releaseConfig.settlementToken.decimals);

  if (!active && data.reservation.status !== 1) return null;

  async function switchNetwork() {
    setSwitching(true);
    setSwitchMessage(undefined);
    try {
      await switchChainAsync({ chainId: releaseConfig.creditcoin.id });
    } catch (error) {
      setSwitchMessage(
        classifyWalletError(error) === "user_rejected"
          ? "Network switch cancelled. Reservation and locked economics are unchanged."
          : `Switch your wallet to ${releaseConfig.creditcoin.name}, then try again.`,
      );
    } finally {
      setSwitching(false);
    }
  }

  return (
    <section className="mt-10 border-t-2 border-ink pt-7" aria-labelledby="reservation-recovery-title">
      <p className="font-mono text-[10px] tracking-wide text-ink-tertiary">PERMISSIONLESS RECOVERY</p>
      <h2 id="reservation-recovery-title" className="mt-2 text-xl font-medium">Reservation release</h2>
      {data.reservation.status === 1 ? (
        <p className="mt-4 border-l-2 border-line-strong pl-4 text-sm leading-6 text-ink-secondary">
          {quantity} {releaseConfig.deliveryToken.symbol} and {payout} {releaseConfig.settlementToken.symbol} were released to the acquisition. The bond was forfeited to the buyer.
        </p>
      ) : data.expiryReadiness === "not_due" ? (
        <p className="mt-4 text-sm leading-6 text-ink-secondary">This reservation remains Active until its delivery deadline. An unresolved reservation can be released after the final source blocks become verifiable.</p>
      ) : data.expiryReadiness === "waiting_source_closure" ? (
        <p className="mt-4 border-l-2 border-pending pl-4 text-sm leading-6 text-ink-secondary">Delivery time has ended. This reservation remains open while the final source blocks become verifiable.</p>
      ) : data.expiryReadiness === "unavailable" ? (
        <p className="mt-4 border-l-2 border-pending pl-4 text-sm leading-6 text-ink-secondary">Expiry readiness is temporarily unavailable. The reservation, payout, and bond remain unchanged. Refresh confirmed state next.</p>
      ) : (
        <p className="mt-4 border-l-2 border-signal pl-4 text-sm leading-6 text-ink-secondary">The reserved quantity and payout return to the acquisition. The reservation bond is forfeited to the buyer.</p>
      )}
      {active && data.expiryReadiness !== "not_due" ? (
        <details className="mt-5 border-y border-line py-4">
          <summary className="min-h-11 cursor-pointer content-center text-sm font-medium outline-none focus-visible:outline-2 focus-visible:outline-signal">Source-closure details</summary>
          <dl className="mt-3 grid gap-4 sm:grid-cols-2">
            <div><dt className="text-xs text-ink-tertiary">Latest attested height</dt><dd className="mt-1 font-mono text-xs">{data.latestAttestedHeight?.toString() ?? "Unavailable"}</dd></div>
            <div><dt className="text-xs text-ink-tertiary">Expiry-eligible height</dt><dd className="mt-1 font-mono text-xs">{data.reservation.expiryEligibleHeight.toString()}</dd></div>
          </dl>
        </details>
      ) : null}
      {active && eligible && wrongChain && connection.address ? (
        <div className="mt-5"><RequiredNetworkMessage requiredChainId={releaseConfig.creditcoin.id} currentChainId={connection.chainId} switching={switching} onSwitch={() => void switchNetwork()} /></div>
      ) : null}
      {switchMessage ? <p className="mt-3 text-sm text-error" role="alert">{switchMessage}</p> : null}
      {active && eligible ? (
        <div className="mt-5">
          <button type="button" disabled={!connection.address || wrongChain || transaction.pending} onClick={() => void transaction.expire()} className="min-h-11 rounded-control bg-signal px-4 text-sm font-medium text-paper-raised outline-none hover:bg-signal-strong disabled:cursor-not-allowed disabled:bg-line-emphasis focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">Release expired reservation</button>
          {!connection.address ? <p className="mt-2 text-xs text-ink-tertiary">Connect a wallet to release this reservation.</p> : null}
        </div>
      ) : null}
      <button type="button" onClick={onRefresh} disabled={transaction.pending} className="mt-4 min-h-11 text-xs font-medium underline underline-offset-4 outline-none disabled:text-ink-tertiary focus-visible:outline-2 focus-visible:outline-signal">Refresh confirmed state</button>
      <div className="mt-4"><TransactionState phase={transaction.phase} chainId={releaseConfig.creditcoin.id} transactionHash={transaction.hash} message={transaction.message} /></div>
    </section>
  );
}
