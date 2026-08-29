import Link from "next/link";

export function MarketEntry() {
  return (
    <section aria-labelledby="market-entry-title" className="bg-ink text-paper">
      <div className="mx-auto max-w-360 px-4 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36">
        <div className="flex items-center" aria-hidden="true">
          <span className="h-4 w-px bg-paper/60" />
          <span className="h-px flex-1 bg-paper/25" />
          <span className="h-4 w-px bg-signal" />
        </div>
        <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.13em] text-paper/55">Open interval → completed acquisition</p>
        <h2 id="market-entry-title" className="mt-6 max-w-4xl text-[38px] leading-[1.05] font-medium tracking-[-0.045em] sm:text-[54px] lg:text-[64px]">
          The delivery chain does not need to know Mozy exists.
        </h2>
        <p className="mt-7 max-w-2xl text-[16px] leading-7 text-paper/65">
          Fund demand on Creditcoin. Receive the approved asset in the wallet you already operate.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3">
          <Link href="/markets" className="inline-flex min-h-11 items-center justify-center rounded-control bg-signal px-5 text-sm font-medium text-paper-raised outline-none transition-colors hover:bg-signal-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper">
            Explore live markets
          </Link>
          <Link href="/how-mozy-works" className="inline-flex min-h-11 items-center text-sm font-medium underline decoration-paper/40 underline-offset-4 outline-none hover:decoration-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper">
            How Mozy works
          </Link>
        </div>
      </div>
    </section>
  );
}
