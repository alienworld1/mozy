"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { getAddress, isAddress } from "viem";
import { useConnection, usePublicClient, useSwitchChain } from "wagmi";
import { releaseConfig } from "@mozy/chain-config";
import { DisabledAction } from "@/components/states/DisabledAction";
import { TransactionState } from "@/components/states/TransactionState";
import { RequiredNetworkMessage } from "@/components/wallet/RequiredNetworkMessage";
import { CancelDialog } from "./CancelDialog";
import { formatTokenAmount } from "./format";
import type { Acquisition } from "./types";
import { useAcquisitionTransactions } from "./useAcquisitionTransactions";
import { useFundingReadiness } from "./useFundingReadiness";
import { useReleaseMarket } from "./useReleaseMarket";
import { OpeningProgress } from "./OpeningProgress";
import { marketAbi, vaultAbi } from "@/lib/acquisition-contracts";
import type { Mandate, VaultAccount } from "./types";

export function LifecycleControls({ acquisition, accountingVerified, onRefresh }: { acquisition: Acquisition; accountingVerified: boolean; onRefresh: () => Promise<unknown> }) {
  const { mandate, account } = acquisition;
  const connection = useConnection(); const { switchChainAsync, isPending: switching } = useSwitchChain();
  const client = usePublicClient({ chainId: releaseConfig.creditcoin.id });
  const address = connection.address && isAddress(connection.address) ? getAddress(connection.address) : undefined;
  const owner = !!address && address.toLowerCase() === mandate.buyer.toLowerCase();
  const readiness = useFundingReadiness(address, owner && mandate.status === 0);
  const releaseMarket = useReleaseMarket();
  const transaction = useAcquisitionTransactions(mandate.id);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refreshingCancel, setRefreshingCancel] = useState(false);
  const [cancelSnapshot, setCancelSnapshot] = useState<{ open: bigint; free: bigint }>();
  const [cancelRefreshMessage, setCancelRefreshMessage] = useState<string>();
  const remaining = mandate.requiredFunding - account.funded;
  const openAmount = mandate.targetAmount - mandate.acquiredAmount - mandate.reservedAmount;
  const [renderedAt] = useState(() => BigInt(Math.floor(Date.now() / 1000)));
  const elapsed = renderedAt >= mandate.mandateExpiry;
  const terminal = mandate.status >= 3 && mandate.status <= 5;
  const wrongChain = connection.chainId !== releaseConfig.creditcoin.id;
  const riskDisabled = !!releaseMarket.data && (!releaseMarket.data.market.enabled || releaseMarket.data.protocolPaused);
  const blocked = !owner || wrongChain || transaction.pending || !accountingVerified;
  const primaryClass = "min-h-11 rounded-control bg-signal px-4 text-sm font-medium text-paper-raised outline-none hover:bg-signal-strong disabled:cursor-not-allowed disabled:bg-line-emphasis focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";
  const secondaryClass = "min-h-11 rounded-control border border-line-strong px-4 text-sm font-medium outline-none hover:bg-wash disabled:cursor-not-allowed disabled:text-ink-tertiary focus-visible:outline-2 focus-visible:outline-signal";
  const openCancel = useCallback(async () => {
    if (!client) return;
    setRefreshingCancel(true);
    setCancelRefreshMessage(undefined);
    try {
      const [freshMandate, freshAccount] = await Promise.all([
        client.readContract({ address: releaseConfig.contracts.market, abi: marketAbi, functionName: "getMandate", args: [mandate.id] }) as Promise<Mandate>,
        client.readContract({ address: releaseConfig.contracts.vault, abi: vaultAbi, functionName: "getAccount", args: [mandate.id] }) as Promise<VaultAccount>,
      ]);
      if (freshMandate.id !== mandate.id || freshMandate.status > 2)
        throw new Error("cancel_ineligible");
      setCancelSnapshot({
        open: freshMandate.targetAmount - freshMandate.acquiredAmount - freshMandate.reservedAmount,
        free: freshAccount.free,
      });
      await onRefresh();
      setCancelOpen(true);
    } catch {
      setCancelRefreshMessage("We couldn’t refresh cancellation terms. Acquisition funds and reservations are unchanged. Refresh confirmed state next.");
    } finally {
      setRefreshingCancel(false);
    }
  }, [client, mandate.id, onRefresh]);

  if (!owner) return <section className="mt-12 border-t-2 border-ink pt-6"><h2 className="text-lg font-medium">Manage acquisition</h2><p className="mt-3 text-sm text-ink-secondary">{address ? "Only the acquisition owner can manage this mandate." : "Connect the owner wallet to manage this acquisition."}</p></section>;
  return <section className="mt-12 border-t-2 border-ink pt-6"><h2 className="text-lg font-medium">Manage acquisition</h2><p className="mt-2 text-sm text-ink-secondary">Each action confirms on Creditcoin before this workspace advances.</p>
    {mandate.status === 0 ? <OpeningProgress allowanceReady={(readiness.data?.allowance ?? 0n) >= remaining} funded={remaining === 0n} open={false} /> : null}
    {wrongChain ? <div className="mt-5"><RequiredNetworkMessage requiredChainId={releaseConfig.creditcoin.id} currentChainId={connection.chainId} switching={switching} onSwitch={() => void switchChainAsync({ chainId: releaseConfig.creditcoin.id })} /></div> : null}
    {!accountingVerified ? <p className="mt-5 border-l-2 border-error pl-4 text-sm text-error">This acquisition’s accounting could not be verified. Refresh before continuing.</p> : null}
    <div className="mt-6 flex flex-wrap gap-3">
      {mandate.status === 0 && remaining > 0n && readiness.data && readiness.data.allowance < remaining ? <button type="button" disabled={blocked} onClick={() => void transaction.run("approve", remaining)} className={primaryClass}>Approve {formatTokenAmount(remaining, releaseConfig.settlementToken.decimals)} BTKT</button> : null}
      {mandate.status === 0 && remaining > 0n && readiness.data && readiness.data.allowance >= remaining ? <button type="button" disabled={blocked || readiness.data.balance < remaining || elapsed || riskDisabled} onClick={() => void transaction.run("fund", remaining)} className={primaryClass}>Fund {formatTokenAmount(remaining, releaseConfig.settlementToken.decimals)} BTKT</button> : null}
      {mandate.status === 0 && readiness.data && readiness.data.balance < remaining ? <div><DisabledAction reason="Your BTKT balance is below the amount left to fund.">Fund acquisition</DisabledAction><Link href="/test-funds" className="mt-2 inline-flex min-h-11 items-center text-xs font-medium underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal">Get demo funds</Link></div> : null}
      {mandate.status === 1 && !elapsed ? <button type="button" disabled={blocked} onClick={() => void transaction.run("pause")} className={primaryClass}>Pause new reservations</button> : null}
      {mandate.status === 2 && !elapsed ? <button type="button" disabled={blocked || riskDisabled} onClick={() => void transaction.run("resume")} className={primaryClass}>Resume reservations</button> : null}
      {mandate.status <= 2 && elapsed ? <button type="button" disabled={blocked} onClick={() => void transaction.run("expire")} className={primaryClass}>Mark as expired</button> : null}
      {mandate.status <= 2 ? <button type="button" disabled={blocked || refreshingCancel} onClick={() => void openCancel()} className={secondaryClass}>{refreshingCancel ? "Refreshing confirmed state…" : "Cancel open remainder"}</button> : null}
      {terminal && account.free > 0n ? <button type="button" disabled={blocked} onClick={() => void transaction.run("refund", account.free)} className={primaryClass}>Reclaim {formatTokenAmount(account.free, releaseConfig.settlementToken.decimals)} BTKT</button> : null}
      {terminal && mandate.reservedAmount === 0n && account.reserved === 0n && account.free === 0n ? <button type="button" disabled={blocked} onClick={() => void transaction.run("close")} className={primaryClass}>Close acquisition</button> : null}
    </div>
    {terminal && (mandate.reservedAmount > 0n || account.reserved > 0n) ? <p className="mt-4 text-sm text-ink-secondary">Close is unavailable while active reservations still hold quantity or payout.</p> : null}
    {terminal && mandate.reservedAmount === 0n && account.reserved === 0n && account.free > 0n ? <p className="mt-4 text-sm text-ink-secondary">Reclaim the remaining free BTKT before closing.</p> : null}
    {cancelRefreshMessage ? <p className="mt-4 border-l-2 border-error pl-4 text-sm leading-6 text-ink-secondary" role="alert">{cancelRefreshMessage}</p> : null}
    {mandate.status === 0 && readiness.isLoading ? <p className="mt-4 text-sm text-pending">Checking BTKT balance and approval…</p> : null}
    {riskDisabled ? <p className="mt-4 text-sm text-pending">{releaseMarket.data?.protocolPaused ? "New acquisitions are temporarily paused. Existing funds remain governed on-chain." : "This market is not accepting new acquisitions."}</p> : null}
    {mandate.status === 0 && readiness.data && readiness.data.allowance >= remaining && remaining > 0n ? <p className="mt-4 text-sm text-success">BTKT approval is ready.</p> : null}
    <div className="mt-6"><TransactionState phase={transaction.phase} chainId={releaseConfig.creditcoin.id} transactionHash={transaction.hash} message={transaction.message} /></div>
    <CancelDialog open={cancelOpen} openAmount={cancelSnapshot?.open ?? openAmount} freeAmount={cancelSnapshot?.free ?? account.free} pending={transaction.pending} onClose={() => setCancelOpen(false)} onConfirm={() => { setCancelOpen(false); void transaction.run("cancel"); }} />
  </section>;
}
