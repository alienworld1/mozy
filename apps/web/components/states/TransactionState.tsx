"use client";

import { m, useReducedMotion } from "motion/react";
import { useState } from "react";
import { isHex, type Hash } from "viem";
import { releaseConfig } from "@mozy/chain-config";
import { getSupportedNetwork } from "@/lib/networks";

export type TransactionPhase =
  | "idle"
  | "awaiting_wallet"
  | "submitted"
  | "confirming"
  | "canonical_confirmed"
  | "delivery_submitted"
  | "waiting_for_verification"
  | "settlement_submitted"
  | "paid"
  | "rejected";

const phasePresentation: Record<
  TransactionPhase,
  { label: string; category: "idle" | "pending" | "success" | "error" }
> = {
  idle: { label: "", category: "idle" },
  awaiting_wallet: { label: "Confirm in wallet", category: "pending" },
  submitted: { label: "Submitted", category: "pending" },
  confirming: { label: "Confirming", category: "pending" },
  canonical_confirmed: { label: "Confirmed", category: "success" },
  delivery_submitted: { label: "Delivery submitted", category: "pending" },
  waiting_for_verification: { label: "Waiting for verification", category: "pending" },
  settlement_submitted: { label: "Settlement submitted", category: "pending" },
  paid: { label: "Paid", category: "success" },
  rejected: { label: "Rejected", category: "error" },
};

const categoryClasses = {
  idle: "border-line text-ink-tertiary",
  pending: "border-pending text-pending",
  success: "border-success text-success",
  error: "border-error text-error",
} as const;

export function TransactionState({
  phase,
  chainId,
  transactionHash,
  message,
  retryable = false,
  onRetry,
}: {
  phase: TransactionPhase;
  chainId?: number;
  transactionHash?: Hash;
  message?: string;
  failureKind?: string;
  retryable?: boolean;
  onRetry?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [copied, setCopied] = useState(false);
  if (phase === "idle") return null;

  const presentation = phasePresentation[phase];
  const network = getSupportedNetwork(chainId);
  const validHash =
    transactionHash && isHex(transactionHash, { strict: true }) && transactionHash.length === 66
      ? transactionHash
      : undefined;
  const explorerUrl = network?.blockExplorers?.default.url;
  const label =
    phase === "confirming" && network
      ? `Confirming on ${network.name}`
      : presentation.label;

  return (
    <m.section
      key={phase}
      aria-live="polite"
      initial={{ opacity: 0, x: reduceMotion ? 0 : -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.16 }}
      className={`border-l-2 py-2 pl-4 ${categoryClasses[presentation.category]}`}
    >
      <div className="flex items-center gap-3">
        <span className="h-2 w-2 border border-current" aria-hidden="true" />
        <p className="text-sm font-medium">{label}</p>
      </div>
      {message ? <p className="mt-2 text-sm text-ink-secondary">{message}</p> : null}
      {validHash ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-xs text-ink-secondary">
          <span title={validHash}>{validHash.slice(0, 10)}…{validHash.slice(-8)}</span>
          {explorerUrl ? (
            <a
              href={`${explorerUrl}/tx/${validHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11 content-center underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal"
            >
              {phase === "rejected" ? "Check transaction" : "View transaction"}
            </a>
          ) : (
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(validHash);
                setCopied(true);
              }}
              className="min-h-11 underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal"
            >
              {copied ? "Hash copied" : "Copy hash"}
            </button>
          )}
        </div>
      ) : null}
      {phase === "rejected" && retryable && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 min-h-11 rounded-control border border-current px-4 text-sm font-medium outline-none focus-visible:outline-2 focus-visible:outline-signal"
        >
          Try again
        </button>
      ) : null}
    </m.section>
  );
}

export const transactionNetworks = {
  settlement: releaseConfig.creditcoin.id,
  delivery: releaseConfig.foreign.id,
} as const;
