import { productMentalModel } from "./content";

export function MentalModel() {
  return (
    <section aria-labelledby="overview-title" className="max-w-3xl">
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-tertiary">
        Overview
      </p>
      <h2
        id="overview-title"
        className="mt-3 text-[24px] leading-8 font-medium tracking-tight"
      >
        Acquisition, delivery, and payment remain distinct.
      </h2>
      <ol className="mt-6 border-y border-line">
        {productMentalModel.statements.map((statement, index) => (
          <li
            key={statement}
            className="grid grid-cols-[36px_1fr] gap-3 border-t border-line py-5 first:border-t-0"
          >
            <span className="font-mono text-xs text-signal">0{index + 1}</span>
            <span className="text-[17px] leading-7 text-ink-secondary">
              {statement}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
