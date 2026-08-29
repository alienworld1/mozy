import type { LandingEvidence } from "./landing-evidence";

export function EvidenceReceipt({ evidence }: { evidence: LandingEvidence }) {
  const verifiedDate = new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(evidence.verifiedAt));

  return (
    <section id="receipt" aria-labelledby="evidence-title" className="scroll-mt-20">
      <div className="mx-auto max-w-360 px-4 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36">
        <div className="flex flex-col gap-5 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-ink-tertiary">
              Verified live-testnet evidence · R{evidence.reservationId}
            </p>
            <h2 id="evidence-title" className="mt-5 max-w-2xl text-[34px] leading-10 font-medium tracking-[-0.035em] sm:text-[42px] sm:leading-12">
              One receipt. Two economic events.
            </h2>
          </div>
          <p className="font-mono text-[10px] text-ink-tertiary">
            VERIFIED {verifiedDate.toUpperCase()}
          </p>
        </div>

        <div className="grid border-b border-line lg:grid-cols-[1fr_72px_0.9fr_72px_1fr] lg:items-stretch">
          <article className="py-8 lg:py-10 lg:pr-8">
            <p className="font-mono text-[10px] text-ink-tertiary">01 · FOREIGN DELIVERY</p>
            <p className="mt-5 text-2xl font-medium">Direct delivery</p>
            <p className="mt-2 text-sm leading-6 text-ink-secondary">
              A standard token transfer reached the buyer wallet on {evidence.foreignNetwork}.
            </p>
          </article>
          <div className="flex items-center border-t border-line py-3 lg:border-t-0 lg:border-l lg:py-0" aria-hidden="true">
            <span className="h-px flex-1 bg-line-strong lg:h-full lg:w-px lg:flex-none" />
            <span className="h-3 w-px bg-signal lg:h-px lg:w-3" />
          </div>
          <article className="py-8 lg:px-8 lg:py-10">
            <p className="font-mono text-[10px] text-ink-tertiary">02 · ATTESTCOIN</p>
            <p className="mt-5 text-2xl font-medium">Receipt verified</p>
            <p className="mt-2 text-sm leading-6 text-ink-secondary">
              The source receipt was authenticated and its replay identity was consumed once.
            </p>
          </article>
          <div className="flex items-center border-t border-line py-3 lg:border-t-0 lg:border-l lg:py-0" aria-hidden="true">
            <span className="h-px flex-1 bg-line-strong lg:h-full lg:w-px lg:flex-none" />
            <span className="h-3 w-px bg-signal lg:h-px lg:w-3" />
          </div>
          <article className="py-8 lg:py-10 lg:pl-8">
            <p className="font-mono text-[10px] text-ink-tertiary">03 · CREDITCOIN SETTLEMENT</p>
            <p className="mt-5 text-2xl font-medium">Payout released</p>
            <p className="mt-2 text-sm leading-6 text-ink-secondary">
              The funded reservation closed on {evidence.settlementNetwork} and paid the stored solver.
            </p>
          </article>
        </div>

        <details className="group border-b border-line">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-medium outline-none marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
            Inspect exact receipt evidence
            <span aria-hidden="true" className="font-mono text-lg font-normal text-signal group-open:rotate-45">+</span>
          </summary>
          <div className="pb-10">
            <div className="grid border-y border-line lg:grid-cols-2">
              <dl className="lg:border-r lg:border-line">
                {[
                  ["Delivered", `${evidence.deliveredAmount} ${evidence.deliveryTokenSymbol}`],
                  ["Payout", `${evidence.payoutAmount} ${evidence.settlementTokenSymbol}`],
                  ["Solver", evidence.solver],
                  ["Recipient", evidence.recipient],
                  ["Token contract", evidence.deliveredToken],
                  ["Replay identity", evidence.replayIdentity],
                ].map(([label, value]) => (
                  <div key={label} className="grid gap-2 border-t border-line px-4 py-4 first:border-t-0 sm:grid-cols-[144px_1fr] sm:px-5">
                    <dt className="text-xs text-ink-tertiary">{label}</dt>
                    <dd className="min-w-0 break-all font-mono text-xs leading-5">{value}</dd>
                  </div>
                ))}
              </dl>
              <dl>
                {evidence.semanticChecks.map((check) => (
                  <div key={check.label} className="grid grid-cols-[1fr_auto] gap-4 border-t border-line px-4 py-3 first:border-t-0 sm:px-5">
                    <dt className="text-xs text-ink-secondary">{check.label}</dt>
                    <dd className="border-l-2 border-success pl-3 font-mono text-[10px] uppercase text-ink">{check.result}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <a href={evidence.foreignExplorerUrl} target="_blank" rel="noreferrer" className="min-w-0 border-l-2 border-line-strong pl-4 outline-none hover:border-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
                <span className="block text-sm font-medium">Inspect foreign delivery</span>
                <span className="mt-1 block truncate font-mono text-[10px] text-ink-tertiary">{evidence.foreignTransaction}</span>
              </a>
              <a href={evidence.settlementExplorerUrl} target="_blank" rel="noreferrer" className="min-w-0 border-l-2 border-line-strong pl-4 outline-none hover:border-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
                <span className="block text-sm font-medium">Inspect Creditcoin settlement</span>
                <span className="mt-1 block truncate font-mono text-[10px] text-ink-tertiary">{evidence.settlementTransaction}</span>
              </a>
            </div>
          </div>
        </details>
        <p className="mt-5 max-w-2xl text-xs leading-5 text-ink-tertiary">
          These are testnet amounts and transactions. They demonstrate the settlement path; they do not represent production volume.
        </p>
      </div>
    </section>
  );
}
