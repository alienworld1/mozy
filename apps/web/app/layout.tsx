import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { MotionProvider } from "@/components/providers/MotionProvider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const metadataOrigin =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(metadataOrigin),
  title: {
    default: "Mozy — Buy there. Pay here.",
    template: "%s · Mozy",
  },
  description:
    "Fund an acquisition on Creditcoin, receive assets directly on Ethereum Sepolia, and release payment after verified delivery.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Mozy — Buy there. Pay here.",
    description:
      "An ordinary Ethereum Sepolia delivery becomes an enforceable Creditcoin settlement right after verification.",
    type: "website",
    url: "/",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Mozy — Buy there. Pay here." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mozy — Buy there. Pay here.",
    description:
      "Fund on Creditcoin. Receive a direct Ethereum Sepolia delivery. Settle after verification.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} antialiased`}
    >
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
