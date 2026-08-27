"use client";

import { useEffect } from "react";
import type { Connector } from "wagmi";

type WalletChainConnection = {
  chainId?: number;
  connector?: Connector;
  status: "connecting" | "reconnecting" | "connected" | "disconnected";
};

export function useSyncWalletChain({
  chainId,
  connector,
  status,
}: WalletChainConnection) {
  useEffect(() => {
    if (status !== "connected" || !connector) return;

    let cancelled = false;
    const activeConnector = connector;

    async function syncFromProvider() {
      try {
        const providerChainId = await activeConnector.getChainId();
        if (!cancelled && providerChainId !== chainId) {
          activeConnector.emitter.emit("change", { chainId: providerChainId });
        }
      } catch {
        // wagmi keeps the last confirmed chain while the provider is unavailable.
      }
    }

    function handleFocus() {
      void syncFromProvider();
    }

    void syncFromProvider();
    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
    };
  }, [chainId, connector, status]);
}
