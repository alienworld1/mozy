import { HiArrowDown, HiArrowRight } from "react-icons/hi2";
import { productMentalModel } from "./content";

export function ProductFlow() {
  return (
    <section id="flow" aria-labelledby="flow-title" className="scroll-mt-8">
      <div className="max-w-3xl">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-tertiary">
          The flow
        </p>
        <h2 id="flow-title" className="mt-3 text-[24px] font-medium">
          Five actions, one locked commitment
        </h2>
      </div>
      <ol className="mt-6 grid border-y border-line md:grid-cols-5">
        {productMentalModel.flowStages.map((stage, index) => (
          <li
            key={stage.label}
            className="relative min-w-0 border-t border-line py-5 first:border-t-0 md:border-t-0 md:border-l md:px-5 md:first:border-l-0"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] text-ink-tertiary">
                0{index + 1}
              </span>
              {index < productMentalModel.flowStages.length - 1 ? (
                <>
                  <HiArrowDown
                    className="text-ink-tertiary md:hidden"
                    aria-hidden="true"
                  />
                  <HiArrowRight
                    className="hidden text-ink-tertiary md:block"
                    aria-hidden="true"
                  />
                </>
              ) : null}
            </div>
            <h3 className="mt-4 text-sm font-medium">{stage.label}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-secondary">
              {stage.detail}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
