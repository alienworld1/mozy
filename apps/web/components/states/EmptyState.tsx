export function EmptyState({
  message,
  supporting,
}: {
  message: string;
  supporting?: string;
}) {
  return (
    <section className="mt-10" aria-label="Workspace status">
      <div className="flex min-h-56 flex-col justify-between border-y border-line py-5 sm:min-h-64">
        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-2 w-2 border border-line-emphasis" />
          <span className="h-px flex-1 bg-line" />
          <span className="h-2 w-2 border border-line-emphasis" />
        </div>
        <div className="max-w-xl">
          <p className="text-[15px] leading-5.5 text-ink-secondary">
            {message}
          </p>
          {supporting ? (
            <p className="mt-2 text-sm leading-6 text-ink-tertiary">
              {supporting}
            </p>
          ) : null}
        </div>
        <div className="h-px w-24 bg-line-strong" aria-hidden="true" />
      </div>
    </section>
  );
}
