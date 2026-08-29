import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="flex h-16 items-center border-b border-line px-4 sm:px-8">
        <span className="text-lg font-medium tracking-[-0.03em]">Mozy</span>
      </header>
      <main className="flex flex-1 items-center px-4 py-16 sm:px-8 lg:px-12">
        <div className="w-full max-w-4xl">
          <p className="mb-8 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink-tertiary">
            Creditcoin settlement · Ethereum Sepolia delivery
          </p>
          <h1 className="max-w-3xl text-[40px] leading-11 font-medium tracking-[-0.035em] text-ink sm:text-[56px] sm:leading-15">
            Acquire assets directly into the wallets you already use.
          </h1>
          <p className="mt-8 max-w-2xl text-[17px] leading-7 text-ink-secondary">
            Fund one acquisition on Creditcoin. Solvers deliver on the
            supported chain, and payment unlocks after delivery is verified.
          </p>
          <ol className="mt-10 max-w-3xl border-y border-line">
            {[
              "Fund the acquisition on Creditcoin.",
              "A solver reserves a fill and sends TEST directly to your Ethereum Sepolia wallet.",
              "Payment unlocks after Attestcoin verification confirms delivery.",
            ].map((statement, index) => (
              <li
                key={statement}
                className="grid grid-cols-[32px_1fr] gap-3 border-t border-line py-4 first:border-t-0"
              >
                <span className="font-mono text-xs text-ink-tertiary">
                  0{index + 1}
                </span>
                <span className="text-[15px] leading-6 text-ink-secondary">
                  {statement}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-6">
            <Link
              href="/markets"
              className="inline-flex min-h-11 items-center justify-center rounded-control bg-signal px-5 text-sm font-medium text-paper-raised transition-colors hover:bg-signal-strong focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
            >
              Explore markets
            </Link>
            <Link
              href="/how-mozy-works"
              className="inline-flex min-h-11 items-center text-sm font-medium underline decoration-line-strong underline-offset-4 outline-none hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
            >
              How Mozy works
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
