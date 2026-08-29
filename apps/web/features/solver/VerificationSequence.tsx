"use client";

import Link from "next/link";
import { m, useReducedMotion } from "motion/react";
import { releaseConfig } from "@mozy/chain-config";
import { StructuralSkeleton } from "@/components/states/StructuralSkeleton";
import { InlineRecoveryMessage } from "@/components/states/InlineRecoveryMessage";
import { formatTokenAmount } from "@/features/acquisitions/format";
import { CopyableValue } from "./CopyableValue";
import type { VerificationCandidate, VerificationPhase } from "./verification";

const phases = [
  { key: "delivery_submitted", label: "Delivery submitted" },
  { key: "delivery_found", label: "Delivery found" },
  { key: "waiting_for_verification", label: "Waiting for verification" },
  { key: "proof_ready", label: "Proof ready" },
  { key: "settlement_submitted", label: "Settlement submitted" },
  { key: "payment_confirmed", label: "Payment confirmed" },
] as const;

function reachedIndex(phase: VerificationPhase) {
  if (
    phase === "preparing_verification" ||
    phase === "delivery_submitted" ||
    phase === "candidate_not_accepted"
  )
    return 0;
  if (phase === "waiting_for_verification") return 2;
  if (phase === "proof_ready") return 3;
  if (phase === "settlement_submitted") return 4;
  return 5;
}

export function VerificationSequence({
  candidate,
  pendingTransactionHash,
  canonicalSettled,
  payout,
  loading,
  refreshing,
  automaticChecksActive,
  lastCheckedAt,
  paused,
  error,
  onRetry,
}: {
  candidate?: VerificationCandidate;
  pendingTransactionHash?: string;
  canonicalSettled: boolean;
  payout: bigint;
  loading: boolean;
  refreshing: boolean;
  automaticChecksActive: boolean;
  lastCheckedAt?: number;
  paused: boolean;
  error?: string;
  onRetry: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const transactionHash = candidate?.transactionHash ?? pendingTransactionHash;
  if (loading && !transactionHash)
    return (
      <section
        className="mt-10 border-t border-line pt-8"
        aria-labelledby="verification-title"
      >
        <h2 id="verification-title" className="text-xl font-medium">
          Verification
        </h2>
        <div className="mt-5">
          <StructuralSkeleton />
        </div>
      </section>
    );
  if (!transactionHash)
    return (
      <section
        className="mt-10 border-t border-line pt-8"
        aria-labelledby="verification-title"
      >
        <h2 id="verification-title" className="text-xl font-medium">
          Verification
        </h2>
        <p className="mt-5 text-sm text-ink-secondary">
          No delivery transaction registered yet.
        </p>
        <p className="mt-1 text-sm text-ink-tertiary">
          Send the exact transfer or register one you already sent.
        </p>
        {error ? (
          <div className="mt-5">
            <InlineRecoveryMessage
              title="We couldn't refresh verification."
              message="Your delivery and reservation are unchanged."
              onRetry={onRetry}
            />
          </div>
        ) : null}
      </section>
    );
  const effectivePhase = candidate
    ? candidate.phase === "payment_confirmed" && !canonicalSettled
      ? "settlement_submitted"
      : candidate.phase
    : "preparing_verification";
  const reached = reachedIndex(effectivePhase);
  const rejected = effectivePhase === "candidate_not_accepted";
  const checkedAt = lastCheckedAt
    ? new Date(lastCheckedAt).toISOString()
    : undefined;
  return (
    <section
      className="mt-10 border-t border-line pt-8"
      aria-labelledby="verification-title"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="verification-title" className="text-xl font-medium">
          Verification
        </h2>
        {refreshing ? (
          <span className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
            Refreshing status
          </span>
        ) : null}
      </div>
      <div className="mt-5 min-w-0">
        <CopyableValue label="Candidate hash" value={transactionHash} />
      </div>
      <a
        href={`${releaseConfig.foreign.blockExplorers.default.url}/tx/${transactionHash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center text-xs underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal"
      >
        View on Ethereum Sepolia
      </a>
      {candidate?.statusMessage &&
      candidate.nextAction === "automatic_retry" ? (
        <p className="mt-4 border-l-2 border-pending pl-4 text-sm leading-6 text-ink-secondary">
          {candidate.statusMessage}
        </p>
      ) : null}
      {automaticChecksActive ? (
        <div className="mt-4 border-y border-line py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium">
              {paused
                ? "Automatic checks are waiting for a connection"
                : refreshing
                  ? "Checking the latest status now"
                  : "Automatic status checks are active"}
            </p>
            <span className="font-mono text-[10px] uppercase tracking-wide text-pending">
              {paused ? "PAUSED" : refreshing ? "CHECKING" : "EVERY 15 SEC"}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-ink-secondary">
            {paused
              ? "Your verification job stays registered. Reconnect to see the latest status here."
              : "We check for verification changes every 15 seconds while this page is visible. Your transaction stays registered if you leave."}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
              {checkedAt ? (
                <>
                  Last checked{" "}
                  <time dateTime={checkedAt}>
                    {checkedAt.slice(11, 19)} UTC
                  </time>
                </>
              ) : (
                "Waiting for first check"
              )}
            </p>
            <button
              type="button"
              disabled={refreshing || paused}
              onClick={onRetry}
              className="min-h-11 text-xs font-medium underline underline-offset-4 outline-none disabled:cursor-not-allowed disabled:text-ink-tertiary focus-visible:outline-2 focus-visible:outline-signal"
            >
              {refreshing ? "Checking…" : "Check now"}
            </button>
          </div>
        </div>
      ) : null}
      <ol className="mt-4" aria-label="Verification phases">
        {phases.map((phase, index) => {
          const complete = !rejected && index < reached;
          const current = rejected ? index === 0 : index === reached;
          return (
            <li
              key={phase.key}
              className="relative flex min-h-16 gap-4 border-t border-line py-4 first:border-t-0"
            >
              <m.span
                initial={false}
                animate={{ scale: current ? 1.12 : 1 }}
                transition={
                  reducedMotion ? { duration: 0 } : { duration: 0.18 }
                }
                className={`mt-0.5 h-3 w-3 shrink-0 rounded-full border-2 ${complete ? "border-ink bg-ink" : current ? (rejected ? "border-error bg-paper" : "border-signal bg-signal") : "border-line-strong bg-paper"}`}
                aria-hidden="true"
              />
              <div>
                <span
                  className={`block text-sm ${current ? "font-medium text-ink" : complete ? "text-ink-secondary" : "text-ink-tertiary"}`}
                >
                  {phase.label}
                </span>
                {current && rejected ? (
                  <p className="mt-1 text-sm leading-6 text-error">
                    {candidate?.reasonMessage ??
                      "Delivery not accepted. We couldn't identify one qualifying standard transfer."}
                  </p>
                ) : null}
                {current && effectivePhase === "preparing_verification" ? (
                  <p className="mt-1 text-sm leading-6 text-ink-secondary">
                    Transaction registered. We’re preparing automatic
                    verification.
                  </p>
                ) : null}
                {current && effectivePhase === "delivery_submitted" ? (
                  <p className="mt-1 text-sm leading-6 text-ink-secondary">
                    Transaction registered. We’re checking for it on Ethereum
                    Sepolia.
                  </p>
                ) : null}
                {current && effectivePhase === "waiting_for_verification" ? (
                  <p className="mt-1 text-sm text-ink-secondary">
                    Delivery found. Waiting for verification.
                  </p>
                ) : null}
                {current && effectivePhase === "proof_ready" ? (
                  <p className="mt-1 text-sm text-ink-secondary">
                    Proof ready. Preparing settlement on Creditcoin.
                  </p>
                ) : null}
                {current && effectivePhase === "settlement_submitted" ? (
                  <p className="mt-1 text-sm text-ink-secondary">
                    Settlement status is being checked. Do not submit another
                    delivery.
                  </p>
                ) : null}
                {current &&
                effectivePhase === "payment_confirmed" &&
                canonicalSettled ? (
                  <p className="mt-1 text-sm text-success">
                    {formatTokenAmount(
                      payout,
                      releaseConfig.settlementToken.decimals,
                    )}{" "}
                    {releaseConfig.settlementToken.symbol} was released to the
                    reserved solver.
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {effectivePhase === "waiting_for_verification" ||
      effectivePhase === "proof_ready" ? (
        <Link
          href="/how-mozy-works#verification-time"
          className="inline-flex min-h-11 items-center text-xs font-medium text-ink-secondary underline decoration-line-strong underline-offset-4 outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-signal"
        >
          Why verification takes time
        </Link>
      ) : null}
      {candidate?.settlementTransactionHash ? (
        <a
          href={`${releaseConfig.creditcoin.blockExplorers.default.url}/tx/${candidate.settlementTransactionHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center text-xs underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal"
        >
          View settlement on Creditcoin
        </a>
      ) : null}
      <div className="sr-only" aria-live="polite">
        {rejected ? candidate?.reasonMessage : phases[reached]?.label}
      </div>
      {error ? (
        <div className="mt-5">
          <InlineRecoveryMessage
            title="We couldn't refresh verification."
            message="Your delivery and reservation are unchanged."
            onRetry={onRetry}
          />
        </div>
      ) : null}
    </section>
  );
}
