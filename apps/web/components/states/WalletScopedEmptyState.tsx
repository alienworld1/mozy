"use client";

import { useConnection } from "wagmi";
import { useHydrated } from "@/hooks/useHydrated";
import { useWalletRestorePending } from "@/components/providers/WalletRestoreProvider";
import { EmptyState } from "@/components/states/EmptyState";

export function WalletScopedEmptyState({
  connectedMessage,
  disconnectedMessage,
}: {
  connectedMessage: string;
  disconnectedMessage: string;
}) {
  const hydrated = useHydrated();
  const walletRestorePending = useWalletRestorePending();
  const connection = useConnection();

  if (
    !hydrated ||
    walletRestorePending ||
    connection.status === "reconnecting"
  ) {
    return (
      <section
        className="mt-10 min-h-56 animate-pulse border-y border-line py-5 motion-reduce:animate-none sm:min-h-64"
        aria-label="Restoring wallet connection"
      >
        <div className="h-px w-full bg-line" />
        <div className="mt-32 h-5 w-full max-w-sm bg-wash" />
      </section>
    );
  }

  return (
    <EmptyState
      message={
        connection.status === "connected"
          ? connectedMessage
          : disconnectedMessage
      }
    />
  );
}
