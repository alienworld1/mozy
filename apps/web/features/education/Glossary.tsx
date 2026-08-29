import { glossary } from "./content";

export function Glossary() {
  return (
    <section
      id="glossary"
      aria-labelledby="glossary-title"
      className="max-w-3xl scroll-mt-8"
    >
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-tertiary">
        Glossary
      </p>
      <h2 id="glossary-title" className="mt-3 text-[24px] font-medium">
        Six terms used across Mozy
      </h2>
      <dl className="mt-6 border-t border-line">
        {glossary.map((entry) => (
          <div
            key={entry.term}
            className="grid gap-2 border-b border-line py-5 sm:grid-cols-[180px_1fr] sm:gap-6"
          >
            <dt className="text-sm font-medium">{entry.term}</dt>
            <dd className="text-sm leading-6 text-ink-secondary">
              {entry.definition}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
