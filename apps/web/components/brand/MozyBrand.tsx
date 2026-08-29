import Link from "next/link";

export function MozyBrand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Mozy home"
      className="inline-flex min-h-11 items-center gap-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
    >
      <span
        aria-hidden="true"
        className="relative block h-5 w-10 shrink-0"
      >
        <span className="absolute top-2.5 left-0 h-px w-full bg-ink" />
        <span className="absolute top-1 left-0 h-3 w-px bg-ink" />
        <span className="absolute top-0.5 right-0 h-4 w-px bg-signal" />
        <span className="absolute top-2 right-[-2px] h-1 w-1 bg-signal" />
        <span className="absolute top-0.5 right-1.5 h-px w-2 bg-signal" />
        <span className="absolute right-1.5 bottom-0.5 h-px w-2 bg-signal" />
      </span>
      <span
        className={
          compact
            ? "text-base font-medium tracking-[-0.03em]"
            : "text-lg font-medium tracking-[-0.03em]"
        }
      >
        Mozy
      </span>
    </Link>
  );
}
