import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import {
  buyerResponsibilities,
  solverResponsibilities,
} from "@/features/education/content";
import { Glossary } from "@/features/education/Glossary";
import { MentalModel } from "@/features/education/MentalModel";
import { ProductFlow } from "@/features/education/ProductFlow";
import { RoleSchedule } from "@/features/education/RoleSchedule";
import { SupportedRelease } from "@/features/education/SupportedRelease";
import { TrustFlow } from "@/features/education/TrustFlow";

export const metadata: Metadata = {
  title: "How Mozy works",
  description:
    "How funded acquisition demand becomes direct delivery and verified settlement.",
};

export default function HowMozyWorksPage() {
  return (
    <article>
      <PageHeader
        title="How Mozy works"
        description="Fund demand on Creditcoin, receive a direct Ethereum Sepolia delivery, and release payment only after verification."
      />

      <div className="mt-12 space-y-12 sm:space-y-16">
        <MentalModel />
        <ProductFlow />

        <div className="grid gap-12 border-t border-line pt-10 lg:grid-cols-2 lg:gap-10">
          <RoleSchedule
            id="buyers"
            title="Buyer responsibilities"
            summary="You fund the maximum settlement budget on Creditcoin and choose the wallet that should receive delivery."
            responsibilities={buyerResponsibilities}
          />
          <RoleSchedule
            id="solvers"
            title="Solver responsibilities"
            summary="You reserve an exact quantity and payout, then send the approved token directly from the reserved wallet."
            responsibilities={solverResponsibilities}
          />
        </div>

        <TrustFlow />

        <section
          aria-labelledby="reservations-title"
          className="max-w-3xl border-t border-line pt-10"
        >
          <h2 id="reservations-title" className="text-[24px] font-medium">
            Why reservations exist
          </h2>
          <p className="mt-4 text-[15px] leading-6 text-ink-secondary">
            A reservation removes one exact quantity from open demand and locks
            its exact payout. It also fixes the delivery source window,
            deadline, and solver address, so a different wallet cannot claim
            the work.
          </p>
          <p className="mt-4 text-[15px] leading-6 text-ink-secondary">
            The reservation bond makes exclusive delivery capacity costly to
            abandon. It returns after settlement and is forfeited to the buyer
            after an unresolved eligible expiry.
          </p>
        </section>

        <section
          id="verification-time"
          aria-labelledby="verification-time-title"
          className="max-w-3xl scroll-mt-8 border-t border-line pt-10"
        >
          <h2 id="verification-time-title" className="text-[24px] font-medium">
            Why verification takes time
          </h2>
          <p className="mt-4 text-[15px] leading-6 text-ink-secondary">
            Delivery can be found before its block is ready to prove. The
            source block must first enter Attestcoin’s attested history; then a
            proof can be built, submitted, and accepted by Creditcoin.
          </p>
          <p className="mt-4 text-[15px] leading-6 text-ink-secondary">
            Payment is released only after Creditcoin accepts the Attestcoin
            proof and Mozy’s delivery checks. No fixed completion time is
            promised, and opening this explanation does not retry or alter the
            proof job.
          </p>
        </section>

        <section
          aria-labelledby="not-do-title"
          className="max-w-3xl border-t border-line pt-10"
        >
          <h2 id="not-do-title" className="text-[24px] font-medium">
            What Mozy does not do
          </h2>
          <p className="mt-4 text-[15px] leading-6 text-ink-secondary">
            Mozy is acquisition procurement, not a bridge. It has no delivery
            contract or adapter on Ethereum Sepolia. The solver calls the
            approved TEST token contract and the token moves directly to the
            buyer. Mozy never takes custody of the delivered TEST asset.
          </p>
          <p className="mt-4 text-[15px] leading-6 text-ink-secondary">
            Delivery and payout happen on different chains. A solver may still
            need to rebalance inventory after settlement. The worker cannot
            authorize or redirect payout; only the Creditcoin contracts can
            settle a valid reservation.
          </p>
        </section>

        <SupportedRelease />
        <Glossary />

        <section
          aria-labelledby="technical-follow-up-title"
          className="max-w-3xl border-t border-line pt-10"
        >
          <h2 id="technical-follow-up-title" className="text-xl font-medium">
            Technical follow-up
          </h2>
          <p className="mt-3 text-sm leading-6 text-ink-secondary">
            Repository documentation: <span className="font-mono">docs/whitepaper.md</span>,{" "}
            <span className="font-mono">docs/architecture.md</span>,{" "}
            <span className="font-mono">docs/attestcoin.md</span>,{" "}
            <span className="font-mono">docs/security.md</span>, and{" "}
            <span className="font-mono">docs/runbook.md</span>.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href="/markets"
              className="inline-flex min-h-11 items-center rounded-control bg-signal px-5 text-sm font-medium text-paper-raised outline-none hover:bg-signal-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
            >
              Explore markets
            </Link>
            <Link
              href="/acquisitions"
              className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal"
            >
              View acquisitions
            </Link>
            <Link
              href="/solver"
              className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal"
            >
              Open solver workspace
            </Link>
          </div>
        </section>
      </div>
    </article>
  );
}
