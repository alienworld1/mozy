"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { decodeEventLog, getAddress, isAddress, type Hash } from "viem";
import { useConnection, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { releaseConfig } from "@mozy/chain-config";
import { RequiredNetworkMessage } from "@/components/wallet/RequiredNetworkMessage";
import { TransactionState, type TransactionPhase } from "@/components/states/TransactionState";
import { marketAbi } from "@/lib/acquisition-contracts";
import { classifyWalletError } from "@/lib/wallet-errors";
import { FundingSummary } from "./FundingSummary";
import { validateAcquisitionDraft, type AcquisitionDraft, type AcquisitionErrors } from "./validation";
import { useReleaseMarket } from "./useReleaseMarket";

const initialDraft: AcquisitionDraft = { target: "", pricingMode: "Limit", limitPrice: "", startPrice: "", endPrice: "", deliveryWallet: "", expiry: "", durationHours: "", durationMinutes: "" };

export function AcquisitionForm() {
  const router = useRouter();
  const connection = useConnection();
  const client = usePublicClient({ chainId: releaseConfig.creditcoin.id });
  const wallet = useWalletClient({ chainId: releaseConfig.creditcoin.id });
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const releaseMarket = useReleaseMarket();
  const [draft, setDraft] = useState(initialDraft);
  const [touched, setTouched] = useState<Set<keyof AcquisitionDraft>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [previewResult, setPreviewResult] = useState<{ key: string; value: bigint }>();
  const [previewFailure, setPreviewFailure] = useState<{ key: string; message: string }>();
  const [phase, setPhase] = useState<TransactionPhase>("idle");
  const [hash, setHash] = useState<Hash>();
  const [transactionMessage, setTransactionMessage] = useState<string>();
  const [uncertain, setUncertain] = useState(false);
  const lastPrefill = useRef<string | undefined>(undefined);
  const previewSequence = useRef(0);
  const validation = useMemo(() => validateAcquisitionDraft(draft), [draft]);
  const errors: AcquisitionErrors = validation.errors;
  const previewKey = validation.terms ? Object.values(validation.terms).map(String).join(":") : "";
  const preview = previewResult?.key === previewKey ? previewResult.value : undefined;
  const previewError = previewFailure?.key === previewKey ? previewFailure.message : undefined;
  const previewing = !!validation.terms && preview === undefined && !previewError;
  const riskDisabled = !!releaseMarket.data && (!releaseMarket.data.market.enabled || releaseMarket.data.protocolPaused);

  useEffect(() => {
    if (!connection.address || !isAddress(connection.address)) return;
    const normalized = getAddress(connection.address);
    setDraft((current) => !current.deliveryWallet || current.deliveryWallet === lastPrefill.current ? { ...current, deliveryWallet: normalized } : current);
    lastPrefill.current = normalized;
  }, [connection.address]);

  useEffect(() => {
    const sequence = ++previewSequence.current;
    if (!validation.terms || !client) return;
    const timeout = window.setTimeout(async () => {
      try {
        const terms = validation.terms!;
        const result = await client.readContract({ address: releaseConfig.contracts.market, abi: marketAbi, functionName: "previewMandateFunding", args: [BigInt(releaseConfig.marketId), terms.deliveryWallet, terms.targetAmount, terms.pricingMode, terms.startPrice, terms.endPrice, terms.mandateExpiry, terms.reservationDuration] });
        if (sequence === previewSequence.current) setPreviewResult({ key: previewKey, value: result });
      } catch {
        if (sequence === previewSequence.current) setPreviewFailure({ key: previewKey, message: "We couldn't calculate the maximum budget. Check the connection and try again." });
      }
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [client, previewKey, validation.terms]);

  function update<K extends keyof AcquisitionDraft>(field: K, value: AcquisitionDraft[K]) { setDraft((current) => ({ ...current, [field]: value })); }
  function fieldError(field: keyof AcquisitionDraft) { return submitted || touched.has(field) ? errors[field] : undefined; }
  function blur(field: keyof AcquisitionDraft) { setTouched((current) => new Set(current).add(field)); }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitted(true);
    if (!validation.terms || preview === undefined || !client || !wallet.data || !connection.address || connection.chainId !== releaseConfig.creditcoin.id) {
      const firstError = Object.keys(errors)[0];
      requestAnimationFrame(() => document.getElementById(firstError)?.focus());
      return;
    }
    let broadcastHash: Hash | undefined;
    let receiptKnown = false;
    setPhase("awaiting_wallet"); setTransactionMessage(undefined); setHash(undefined); setUncertain(false);
    try {
      const terms = validation.terms;
      const refreshedPreview = await client.readContract({ address: releaseConfig.contracts.market, abi: marketAbi, functionName: "previewMandateFunding", args: [1n, terms.deliveryWallet, terms.targetAmount, terms.pricingMode, terms.startPrice, terms.endPrice, terms.mandateExpiry, terms.reservationDuration] });
      const simulation = await client.simulateContract({ account: connection.address, address: releaseConfig.contracts.market, abi: marketAbi, functionName: "createMandate", args: [1n, terms.deliveryWallet, terms.targetAmount, terms.pricingMode, terms.startPrice, terms.endPrice, terms.mandateExpiry, terms.reservationDuration] });
      const txHash = await wallet.data.writeContract(simulation.request); broadcastHash = txHash; setHash(txHash); setPhase("submitted"); setPhase("confirming");
      const receipt = await client.waitForTransactionReceipt({ hash: txHash });
      receiptKnown = true;
      if (receipt.status !== "success") throw new Error("Transaction reverted");
      let mandateId: bigint | undefined;
      for (const log of receipt.logs) { try { const decoded = decodeEventLog({ abi: marketAbi, data: log.data, topics: log.topics }); if (decoded.eventName === "MandateCreated") mandateId = decoded.args.mandateId; } catch {} }
      if (!mandateId) throw new Error("Creation event unavailable");
      const mandate = await client.readContract({ address: releaseConfig.contracts.market, abi: marketAbi, functionName: "getMandate", args: [mandateId] });
      if (mandate.buyer.toLowerCase() !== connection.address.toLowerCase() || mandate.requiredFunding !== refreshedPreview) throw new Error("Created terms did not reconcile");
      setPhase("canonical_confirmed"); setTransactionMessage(`Acquisition M${mandateId} created. Continue with approval and funding.`);
      router.replace(`/acquisitions/${mandateId}`);
    } catch (error) {
      setPhase("rejected");
      const statusUncertain = !!broadcastHash && !receiptKnown;
      setUncertain(statusUncertain);
      setTransactionMessage(statusUncertain ? "Transaction status is uncertain. Check the transaction before trying again." : classifyWalletError(error) === "user_rejected" ? "Transaction cancelled. Nothing was submitted." : "We couldn't create this acquisition. No confirmed acquisition was assumed.");
    }
  }

  const inputClass = "mt-2 min-h-11 w-full rounded-control border border-line-strong bg-paper-raised px-3 text-base outline-none focus:border-signal focus:ring-1 focus:ring-signal aria-invalid:border-error";
  const errorText = (field: keyof AcquisitionDraft) => fieldError(field) ? <p id={`${field}-error`} className="mt-2 text-sm text-error">{fieldError(field)}</p> : null;
  return (
    <div className="mt-12 grid gap-12 lg:grid-cols-12">
      <form onSubmit={submit} noValidate className="space-y-10 lg:col-span-7">
        <section><h2 className="text-lg font-medium">What do you want?</h2><p className="mt-2 text-2xl font-medium">Acquire TEST on Ethereum Sepolia</p><p className="mt-1 text-sm text-ink-secondary">Funded in BTKT on Creditcoin</p></section>
        <section><h2 className="text-lg font-medium">Where do you want it?</h2><p className="mt-2 text-sm leading-6 text-ink-secondary">TEST is delivered directly to the Ethereum Sepolia wallet you confirm below.</p></section>
        <section><label htmlFor="target" className="text-lg font-medium">How much?</label><div className="relative"><input id="target" inputMode="decimal" value={draft.target} onChange={(e) => update("target", e.target.value)} onBlur={() => blur("target")} aria-invalid={!!fieldError("target")} aria-describedby={fieldError("target") ? "target-error" : undefined} className={`${inputClass} pr-16`} /><span className="absolute right-3 top-5 text-sm text-ink-tertiary">TEST</span></div>{errorText("target")}</section>
        <fieldset><legend className="text-lg font-medium">How should Mozy buy?</legend><div className="mt-4 grid gap-3 sm:grid-cols-2">{(["Limit", "Range"] as const).map((mode) => <label key={mode} className={`min-h-20 cursor-pointer border p-4 ${draft.pricingMode === mode ? "border-signal" : "border-line"}`}><input type="radio" name="pricingMode" value={mode} checked={draft.pricingMode === mode} onChange={() => update("pricingMode", mode)} className="mr-3 accent-signal" /><span className="font-medium">{mode}</span><span className="mt-1 block pl-6 text-sm text-ink-secondary">{mode === "Limit" ? "Pay the same maximum price for every unit." : "Let the payout price move linearly across the acquisition."}</span></label>)}</div>
          {draft.pricingMode === "Limit" ? <div className="mt-5"><label htmlFor="limitPrice">Pay up to</label><div className="relative"><input id="limitPrice" inputMode="decimal" value={draft.limitPrice} onChange={(e) => update("limitPrice", e.target.value)} onBlur={() => blur("limitPrice")} aria-invalid={!!fieldError("limitPrice")} aria-describedby={fieldError("limitPrice") ? "limitPrice-error" : undefined} className={`${inputClass} pr-32`} /><span className="absolute right-3 top-5 text-sm text-ink-tertiary">BTKT / TEST</span></div>{errorText("limitPrice")}</div> : <div className="mt-5 grid gap-5 sm:grid-cols-2">{(["startPrice", "endPrice"] as const).map((field) => <div key={field}><label htmlFor={field}>{field === "startPrice" ? "Start price" : "End price"}</label><div className="relative"><input id={field} inputMode="decimal" value={draft[field]} onChange={(e) => update(field, e.target.value)} onBlur={() => blur(field)} aria-invalid={!!fieldError(field)} aria-describedby={fieldError(field) ? `${field}-error` : undefined} className={`${inputClass} pr-20`} /><span className="absolute right-3 top-5 text-sm text-ink-tertiary">BTKT</span></div>{errorText(field)}</div>)}</div>}
        </fieldset>
        <section><label htmlFor="deliveryWallet" className="text-lg font-medium">Delivery wallet</label><input id="deliveryWallet" value={draft.deliveryWallet} onChange={(e) => update("deliveryWallet", e.target.value)} onBlur={() => blur("deliveryWallet")} aria-invalid={!!fieldError("deliveryWallet")} aria-describedby={fieldError("deliveryWallet") ? "deliveryWallet-error" : "delivery-wallet-help"} className={`${inputClass} font-mono text-sm`} /><p id="delivery-wallet-help" className="mt-2 text-sm text-ink-secondary">Confirm the full Ethereum Sepolia address that should receive TEST.</p>{errorText("deliveryWallet")}</section>
        <section><label htmlFor="expiry" className="text-lg font-medium">Expiry</label><input id="expiry" type="datetime-local" value={draft.expiry} onChange={(e) => update("expiry", e.target.value)} onBlur={() => blur("expiry")} aria-invalid={!!fieldError("expiry")} aria-describedby={fieldError("expiry") ? "expiry-error" : undefined} className={inputClass} />{errorText("expiry")}</section>
        <section><h2 className="text-lg font-medium">Reservation duration</h2><div className="mt-2 grid grid-cols-2 gap-4"><div><label htmlFor="durationHours" className="text-sm text-ink-secondary">Hours</label><input id="durationHours" inputMode="numeric" value={draft.durationHours} onChange={(e) => update("durationHours", e.target.value)} onBlur={() => blur("durationHours")} aria-invalid={!!fieldError("durationHours")} aria-describedby={fieldError("durationHours") ? "durationHours-error" : undefined} className={inputClass} /></div><div><label htmlFor="durationMinutes" className="text-sm text-ink-secondary">Minutes</label><input id="durationMinutes" inputMode="numeric" value={draft.durationMinutes} onChange={(e) => update("durationMinutes", e.target.value)} onBlur={() => blur("durationMinutes")} className={inputClass} /></div></div>{errorText("durationHours")}</section>
        {connection.chainId !== releaseConfig.creditcoin.id && connection.status === "connected" ? <RequiredNetworkMessage requiredChainId={releaseConfig.creditcoin.id} currentChainId={connection.chainId} switching={switching} onSwitch={() => void switchChainAsync({ chainId: releaseConfig.creditcoin.id })} /> : null}
        <button type="submit" disabled={!validation.terms || preview === undefined || riskDisabled || uncertain || connection.status !== "connected" || connection.chainId !== releaseConfig.creditcoin.id || phase === "awaiting_wallet" || phase === "confirming"} className="min-h-11 w-full rounded-control bg-signal px-5 text-sm font-medium text-paper-raised outline-none hover:bg-signal-strong disabled:cursor-not-allowed disabled:bg-line-emphasis focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">Open acquisition</button>
        {riskDisabled ? <p className="text-sm text-pending">{releaseMarket.data?.protocolPaused ? "New acquisitions are temporarily paused. Existing funds remain governed on-chain." : "This market is not accepting new acquisitions."}</p> : null}
        {connection.status !== "connected" ? <p className="text-sm text-ink-secondary">Connect your wallet to continue.</p> : null}
        <TransactionState phase={phase} chainId={releaseConfig.creditcoin.id} transactionHash={hash} message={transactionMessage} />
      </form>
      <div className="lg:col-span-5"><FundingSummary terms={validation.terms} preview={preview} calculating={previewing} error={previewError} /></div>
    </div>
  );
}
