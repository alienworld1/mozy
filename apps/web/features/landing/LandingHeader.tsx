import Link from "next/link";
import { MozyBrand } from "@/components/brand/MozyBrand";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-360 items-center justify-between gap-6 px-4 sm:px-8 lg:px-12">
        <MozyBrand />
        <nav aria-label="Landing page" className="flex items-center gap-5 sm:gap-8">
          <a
            href="#mechanism"
            className="hidden min-h-11 items-center text-sm text-ink-secondary outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal sm:inline-flex"
          >
            How it works
          </a>
          <a
            href="#receipt"
            className="hidden min-h-11 items-center text-sm text-ink-secondary outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal md:inline-flex"
          >
            Receipt
          </a>
          <Link
            href="/markets"
            className="inline-flex min-h-11 items-center justify-center rounded-control bg-signal px-4 text-sm font-medium text-paper-raised outline-none transition-colors hover:bg-signal-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            Explore markets
          </Link>
        </nav>
      </div>
    </header>
  );
}
