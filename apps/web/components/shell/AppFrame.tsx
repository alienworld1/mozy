import Link from "next/link";
import type { ReactNode } from "react";
import { ProductNavigation } from "@/components/shell/ProductNavigation";
import { WalletControl } from "@/components/wallet/WalletControl";

export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[1fr_auto] grid-rows-[64px_48px_1fr] bg-paper lg:grid-cols-[216px_1fr] lg:grid-rows-[88px_1fr_auto]">
      <a
        href="#main-workspace"
        className="fixed left-4 top-0 z-50 -translate-y-full bg-ink px-4 py-3 text-sm font-medium text-paper focus:translate-y-4"
      >
        Skip to workspace
      </a>

      <div className="flex items-center border-b border-line px-4 lg:border-r lg:border-b-0 lg:px-6">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-lg font-medium tracking-[-0.03em] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          aria-label="Mozy home"
        >
          Mozy
        </Link>
      </div>

      <div className="relative z-30 flex items-center justify-end border-b border-line px-4 lg:col-start-1 lg:row-start-3 lg:border-r lg:border-b-0 lg:px-4 lg:py-5">
        <WalletControl />
      </div>

      <div className="col-span-2 border-b border-line lg:col-span-1 lg:col-start-1 lg:row-start-2 lg:border-r lg:border-b-0 lg:pt-4">
        <ProductNavigation />
      </div>

      <main
        id="main-workspace"
        tabIndex={-1}
        className="col-span-2 min-w-0 px-4 py-10 outline-none sm:px-6 sm:py-12 lg:col-span-1 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:px-8 lg:py-16 xl:px-12"
      >
        <div className="mx-auto w-full max-w-300">{children}</div>
      </main>
    </div>
  );
}
