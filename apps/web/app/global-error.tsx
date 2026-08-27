"use client";

export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-paper px-4 text-ink">
        <title>Mozy could not start</title>
        <main className="w-full max-w-xl border-y border-error py-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-error">
            Startup error
          </p>
          <h1 className="mt-3 text-[30px] leading-9 font-medium">
            We couldn’t start Mozy.
          </h1>
          <p className="mt-3 text-sm leading-6 text-ink-secondary">
            The application did not initialize. Nothing was submitted and no economic state was assumed to change.
          </p>
          <button
            type="button"
            onClick={retry}
            className="mt-6 min-h-11 rounded-control bg-signal px-4 text-sm font-medium text-paper-raised outline-none hover:bg-signal-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
