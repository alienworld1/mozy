export function InlineRecoveryMessage({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <section className="mt-10 border-y border-error py-6" role="alert">
      <h2 className="text-lg font-medium text-error">{title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-ink-secondary">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 min-h-11 rounded-control bg-signal px-4 text-sm font-medium text-paper-raised outline-none hover:bg-signal-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
        >
          Try again
        </button>
      ) : null}
    </section>
  );
}
