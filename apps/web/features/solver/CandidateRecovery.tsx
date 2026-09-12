"use client";

import { releaseConfig } from "@mozy/chain-config";
import { formatTokenAmount } from "@/features/acquisitions/format";
import type { ReservationWorkspaceData } from "./useReservationWorkspace";
import type { VerificationCandidate } from "./verification";

export function CandidateRecovery({
  candidate,
  data,
  canReplace,
  onReplace,
}: {
  candidate?: VerificationCandidate;
  data: ReservationWorkspaceData;
  canReplace: boolean;
  onReplace: () => void;
}) {
  if (candidate?.phase !== "candidate_not_accepted") return null;
  return (
    <section className="mt-6 border-l-2 border-error py-1 pl-4" aria-labelledby="candidate-recovery-title">
      <p className="font-mono text-[10px] tracking-wide text-ink-tertiary">AFFECTED CANDIDATE</p>
      <h2 id="candidate-recovery-title" className="mt-2 text-lg font-medium text-error">{candidate.reasonMessage}</h2>
      <p className="mt-3 text-sm leading-6 text-ink-secondary">
        Reservation R{data.reservation.id.toString()} is still Active. Its payout and bond remain locked.
      </p>
      {candidate.reasonClass === "wrong_token" ||
      candidate.reasonClass === "indirect_token_call" ? (
        <p className="mt-3 text-sm leading-6 text-ink-secondary">
          A token event is not enough for this release. The transaction&apos;s
          outer target must be the TEST contract and its calldata must be a
          direct transfer. Turn off smart-account transactions, batching, or
          delegated execution before sending the replacement.
        </p>
      ) : null}
      <dl className="mt-4 grid gap-3 border-y border-line py-4 text-xs sm:grid-cols-2">
        <div><dt className="text-ink-tertiary">Required token</dt><dd className="mt-1 font-mono break-all">{releaseConfig.deliveryToken.address}</dd></div>
        <div><dt className="text-ink-tertiary">Required sender</dt><dd className="mt-1 font-mono break-all">{data.reservation.solver}</dd></div>
        <div><dt className="text-ink-tertiary">Required recipient</dt><dd className="mt-1 font-mono break-all">{data.requirements.deliveryWallet}</dd></div>
        <div><dt className="text-ink-tertiary">Minimum quantity</dt><dd className="mt-1 font-mono">{formatTokenAmount(data.reservation.quantity, releaseConfig.deliveryToken.decimals)} {releaseConfig.deliveryToken.symbol}</dd></div>
        <div><dt className="text-ink-tertiary">Source-height window</dt><dd className="mt-1 font-mono">{data.reservation.sourceStartHeight.toString()}–{data.reservation.sourceEndHeight.toString()}</dd></div>
      </dl>
      <p className="mt-4 text-sm leading-6 text-ink-secondary">The prior foreign transfer is not reversed and remains in candidate history.</p>
      {canReplace ? (
        <button type="button" onClick={onReplace} className="mt-4 min-h-11 rounded-control bg-signal px-4 text-sm font-medium text-paper-raised outline-none hover:bg-signal-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">Register another transaction</button>
      ) : (
        <p className="mt-4 text-sm text-ink-secondary">Connect the reserved solver wallet to register another transaction.</p>
      )}
    </section>
  );
}
