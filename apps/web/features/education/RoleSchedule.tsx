export function RoleSchedule({
  id,
  title,
  summary,
  responsibilities,
}: {
  id: string;
  title: string;
  summary: string;
  responsibilities: readonly string[];
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-8">
      <h2 id={`${id}-title`} className="text-xl font-medium">
        {title}
      </h2>
      <p className="mt-3 text-[15px] leading-6 text-ink-secondary">
        {summary}
      </p>
      <ol className="mt-5 border-t border-line">
        {responsibilities.map((responsibility, index) => (
          <li
            key={responsibility}
            className="grid grid-cols-[28px_1fr] gap-3 border-b border-line py-4 text-sm leading-6"
          >
            <span className="font-mono text-[10px] text-ink-tertiary">
              0{index + 1}
            </span>
            <span>{responsibility}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
