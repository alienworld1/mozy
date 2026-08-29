"use client";

import { m, useReducedMotion } from "motion/react";
import { RiArrowDownLine, RiArrowRightLine } from "react-icons/ri";
import { formatTokenAmount } from "@/features/acquisitions/format";
import type { DeliveryReceipt } from "./types";
import { CopyableValue } from "@/features/solver/CopyableValue";

export function ReceiptRelationship({ receipt }: { receipt: DeliveryReceipt }) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.34 };
  const observed = formatTokenAmount(BigInt(receipt.foreign.observedAmount), receipt.foreign.tokenDecimals);
  const payout = formatTokenAmount(BigInt(receipt.creditcoin.payoutAmount), receipt.creditcoin.payoutTokenDecimals);
  const stageClass = "min-w-0 border-t-2 border-line-strong pt-5";
  return (
    <section className="mt-10 border-y border-line py-8" aria-labelledby="receipt-relationship-title">
      <h2 id="receipt-relationship-title" className="sr-only">Verified delivery and settlement relationship</h2>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,0.9fr)_2.5rem_minmax(0,1fr)] md:items-center">
        <m.article
          initial={reduceMotion ? false : { opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={transition}
          className={stageClass}
        >
          <p className="font-mono text-[10px] tracking-wide text-ink-tertiary">01 · FOREIGN DELIVERY</p>
          <p className="mt-3 font-mono text-2xl font-medium tabular-nums">{observed} {receipt.foreign.tokenSymbol}</p>
          <p className="mt-2 text-sm leading-6 text-ink-secondary">Delivered to the buyer on {receipt.foreign.chainName}</p>
          {receipt.foreign.standardTransferVerified ? <p className="mt-4 text-xs font-medium uppercase tracking-wide">Standard token transfer</p> : null}
          <div className="mt-4"><CopyableValue label="Foreign delivery transaction" value={receipt.foreign.transactionHash} /></div>
        </m.article>
        <div className="flex justify-center text-line-emphasis" aria-hidden="true">
          <RiArrowDownLine className="md:hidden" />
          <RiArrowRightLine className="hidden md:block" />
        </div>
        <m.article
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...transition, delay: reduceMotion ? 0 : 0.08 }}
          className="min-w-0 border-t-2 border-signal pt-5"
        >
          <p className="font-mono text-[10px] tracking-wide text-ink-tertiary">02 · ATTESTCOIN VERIFICATION</p>
          <p className="mt-3 text-xl font-medium">Verified</p>
          <p className="mt-2 text-sm leading-6 text-ink-secondary">The authenticated source receipt was consumed once for R{receipt.reservationId}.</p>
        </m.article>
        <div className="flex justify-center text-line-emphasis" aria-hidden="true">
          <RiArrowDownLine className="md:hidden" />
          <RiArrowRightLine className="hidden md:block" />
        </div>
        <m.article
          initial={reduceMotion ? false : { opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...transition, delay: reduceMotion ? 0 : 0.16 }}
          className={stageClass}
        >
          <p className="font-mono text-[10px] tracking-wide text-ink-tertiary">03 · CREDITCOIN SETTLEMENT</p>
          <p className="mt-3 font-mono text-2xl font-medium tabular-nums">{payout} {receipt.creditcoin.payoutTokenSymbol}</p>
          <p className="mt-2 text-sm leading-6 text-ink-secondary">Locked payout released to the solver</p>
          <p className="mt-4 border-l-2 border-success pl-3 text-xs font-medium uppercase tracking-wide">Successful</p>
          <div className="mt-4"><CopyableValue label="Creditcoin settlement transaction" value={receipt.creditcoin.transactionHash} /></div>
        </m.article>
      </div>
      {receipt.foreign.directDeliveryVerified ? (
        <p className="mt-8 border-l-2 border-line-strong pl-4 text-sm text-ink-secondary">No Mozy delivery contract was involved.</p>
      ) : null}
    </section>
  );
}
