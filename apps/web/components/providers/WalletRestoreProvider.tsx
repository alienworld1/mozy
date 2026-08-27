"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useConnectors } from "wagmi";
import { reconnect } from "wagmi/actions";
import { wagmiConfig } from "@/lib/wagmi";

const WalletRestoreContext = createContext(true);

export function WalletRestoreProvider({ children }: { children: ReactNode }) {
  const connectors = useConnectors();
  const attempted = useRef(false);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    if (attempted.current) return;
    let cancelled = false;
    let unavailableConnectorTimer: ReturnType<typeof setTimeout> | undefined;

    const frame = requestAnimationFrame(() => {
      void (async () => {
        try {
          const preferredConnectorId =
            await wagmiConfig.storage?.getItem("recentConnectorId");
          if (cancelled || attempted.current) return;

          if (!preferredConnectorId) {
            attempted.current = true;
            setRestoring(false);
            return;
          }

          const preferredConnector = connectors.find(
            (connector) => connector.id === preferredConnectorId,
          );
          if (!preferredConnector) {
            unavailableConnectorTimer = setTimeout(() => {
              if (cancelled) return;
              attempted.current = true;
              setRestoring(false);
            }, 500);
            return;
          }

          attempted.current = true;
          await reconnect(wagmiConfig, { connectors: [preferredConnector] });
        } finally {
          if (!cancelled && attempted.current) setRestoring(false);
        }
      })();
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (unavailableConnectorTimer) clearTimeout(unavailableConnectorTimer);
    };
  }, [connectors]);

  return (
    <WalletRestoreContext.Provider value={restoring}>
      {children}
    </WalletRestoreContext.Provider>
  );
}

export function useWalletRestorePending() {
  return useContext(WalletRestoreContext);
}
