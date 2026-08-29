"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { WalletRestoreProvider } from "@/components/providers/WalletRestoreProvider";
import { wagmiConfig } from "@/lib/wagmi";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 15_000,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <WalletRestoreProvider>{children}</WalletRestoreProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
