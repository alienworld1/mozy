import type { Metadata } from "next";
import { DirectWalletAct } from "@/features/landing/DirectWalletAct";
import { EvidenceReceipt } from "@/features/landing/EvidenceReceipt";
import { LandingFooter } from "@/features/landing/LandingFooter";
import { LandingHeader } from "@/features/landing/LandingHeader";
import { MarketEntry } from "@/features/landing/MarketEntry";
import { ReceiptMechanism } from "@/features/landing/ReceiptMechanism";
import { ReleaseDescription } from "@/features/landing/ReleaseDescription";
import { landingEvidence } from "@/features/landing/landing-evidence";

export const metadata: Metadata = {
  title: "Buy there. Pay here.",
  description:
    "Fund an acquisition on Creditcoin. Receive a direct Ethereum Sepolia delivery. Release the reserved payout after its ordinary transfer receipt is verified.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Mozy — Buy there. Pay here.",
    description:
      "An ordinary foreign transfer receipt becomes an enforceable Creditcoin settlement right.",
    type: "website",
    url: "/",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Mozy — Buy there. Pay here." }],
  },
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-paper">
      <a
        href="#main-content"
        className="fixed top-0 left-4 z-[60] -translate-y-full bg-ink px-4 py-3 text-sm font-medium text-paper focus:translate-y-4"
      >
        Skip to main content
      </a>
      <LandingHeader />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <ReceiptMechanism />
        <DirectWalletAct recipient={landingEvidence?.recipient} />
        {landingEvidence ? <EvidenceReceipt evidence={landingEvidence} /> : <ReleaseDescription />}
        <MarketEntry />
      </main>
      <LandingFooter evidence={landingEvidence} />
    </div>
  );
}
