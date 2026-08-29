import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-12 text-ink">
      <section className="w-full max-w-xl border-y border-line py-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-tertiary">
          Page not found
        </p>
        <h1 className="mt-3 text-[30px] leading-9 font-medium">
          We couldn&apos;t find that page.
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-secondary">
          The address may be out of date. You can return to the current open acquisitions.
        </p>
        <Link
          href="/markets"
          className="mt-6 inline-flex min-h-11 items-center rounded-control bg-signal px-4 text-sm font-medium text-paper-raised outline-none hover:bg-signal-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
        >
          View markets
        </Link>
      </section>
    </main>
  );
}
