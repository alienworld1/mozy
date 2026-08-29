import Link from "next/link";
import { MozyBrand } from "@/components/brand/MozyBrand";
import type { LandingEvidence } from "./landing-evidence";

const repositoryBase = "https://github.com/alienworld1/mozy";

export function LandingFooter({ evidence }: { evidence: LandingEvidence }) {
  const links = [
    { label: "Markets", href: "/markets", internal: true },
    { label: "Architecture", href: `${repositoryBase}/blob/main/docs/architecture.md`, internal: false },
    { label: "Security", href: `${repositoryBase}/blob/main/docs/security.md`, internal: false },
    { label: "Repository", href: repositoryBase, internal: false },
    { label: "Sepolia delivery", href: evidence.foreignExplorerUrl, internal: false },
    { label: "Creditcoin settlement", href: evidence.settlementExplorerUrl, internal: false },
  ] as const;

  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto grid max-w-360 gap-8 px-4 py-10 sm:px-8 lg:grid-cols-[1fr_2fr] lg:px-12">
        <div>
          <MozyBrand compact />
          <p className="mt-3 font-mono text-[10px] text-ink-tertiary">LIVE TESTNET · CC3 / SEPOLIA</p>
        </div>
        <nav aria-label="Resources" className="lg:justify-self-end">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {links.map((link) => (
              <li key={link.label}>
                {link.internal ? (
                  <Link href={link.href} className="inline-flex min-h-11 items-center text-xs text-ink-secondary outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
                    {link.label}
                  </Link>
                ) : (
                  <a href={link.href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-xs text-ink-secondary outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
                    {link.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
