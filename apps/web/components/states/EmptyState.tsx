export function EmptyState({ message }: { message: string }) {
  return (
    <section className="mt-10" aria-label="Workspace status">
      <div className="flex min-h-56 flex-col justify-between border-y border-line py-5 sm:min-h-64">
        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-2 w-2 border border-line-emphasis" />
          <span className="h-px flex-1 bg-line" />
          <span className="h-2 w-2 border border-line-emphasis" />
        </div>
        <p className="max-w-xl text-[15px] leading-[22px] text-ink-secondary">
          {message}
        </p>
        <div className="h-px w-24 bg-line-strong" aria-hidden="true" />
      </div>
    </section>
  );
}
