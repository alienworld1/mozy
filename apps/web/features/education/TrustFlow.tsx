import { HiArrowDown, HiArrowRight } from "react-icons/hi2";

const trustStages = [
  {
    system: "Ethereum Sepolia",
    action: "Direct delivery",
    detail: "TEST moves from the reserved solver address to the buyer wallet.",
  },
  {
    system: "Attestcoin",
    action: "Receipt verification",
    detail: "An authenticated receipt proves what the standard transfer did.",
  },
  {
    system: "Creditcoin",
    action: "Canonical settlement",
    detail: "Mozy’s contracts validate the terms and release locked payment.",
  },
] as const;

export function TrustFlow() {
  return (
    <section id="trust" aria-labelledby="trust-title" className="scroll-mt-8">
      <div className="max-w-3xl">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-tertiary">
          Trust relationship
        </p>
        <h2 id="trust-title" className="mt-3 text-[24px] font-medium">
          Evidence moves. The delivered asset does not.
        </h2>
        <p className="mt-4 text-[15px] leading-6 text-ink-secondary">
          Attestcoin does not carry TEST or control payout. It makes the
          Ethereum Sepolia receipt verifiable by Mozy’s Creditcoin contracts.
        </p>
      </div>
      <ol className="mt-6 grid border-y border-line bg-wash md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
        {trustStages.map((stage, index) => (
          <li key={stage.system} className="contents">
            <div className="p-5 sm:p-6">
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
                {stage.system}
              </p>
              <h3 className="mt-3 text-lg font-medium">{stage.action}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-secondary">
                {stage.detail}
              </p>
            </div>
            {index < trustStages.length - 1 ? (
              <div
                className="flex items-center justify-center border-t border-line py-2 text-signal md:border-t-0 md:border-l md:px-2 md:py-0"
                aria-hidden="true"
              >
                <HiArrowDown className="md:hidden" />
                <HiArrowRight className="hidden md:block" />
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-ink-secondary">
        The worker finds transactions, obtains proofs, and submits settlement.
        It cannot decide that a delivery is valid or redirect payment.
      </p>
    </section>
  );
}
