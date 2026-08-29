export function ReleaseDescription() {
  return (
    <section id="receipt" aria-labelledby="release-description-title" className="scroll-mt-20">
      <div className="mx-auto max-w-360 px-4 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36">
        <div className="border-y border-line py-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-ink-tertiary">
            Current release
          </p>
          <h2 id="release-description-title" className="mt-5 max-w-2xl text-[34px] leading-10 font-medium tracking-[-0.035em] sm:text-[42px] sm:leading-12">
            Delivery evidence controls settlement.
          </h2>
          <p className="mt-5 max-w-3xl text-sm leading-6 text-ink-secondary">
            Mozy verifies an ordinary Ethereum Sepolia token transfer before the funded Creditcoin reservation can release its locked payout. Current public transaction evidence will appear here only after it has been validated against this release deployment.
          </p>
        </div>
      </div>
    </section>
  );
}
