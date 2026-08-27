"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IoCloseOutline, IoCopyOutline } from "react-icons/io5";
import { getAddress, isAddress } from "viem";
import {
  useConnect,
  useConnection,
  useConnections,
  useConnectors,
  useDisconnect,
  useSwitchChain,
  type Connector,
} from "wagmi";
import { releaseConfig, type SupportedChainId } from "@mozy/chain-config";
import { useHydrated } from "@/hooks/useHydrated";
import { useSyncWalletChain } from "@/hooks/useSyncWalletChain";
import { useWalletRestorePending } from "@/components/providers/WalletRestoreProvider";
import { wagmiConfig } from "@/lib/wagmi";
import { getNetworkName, getSupportedNetwork } from "@/lib/networks";
import { classifyWalletError } from "@/lib/wallet-errors";

export function WalletControl() {
  const hydrated = useHydrated();
  const walletRestorePending = useWalletRestorePending();
  const reduceMotion = useReducedMotion();
  const connection = useConnection();
  const connections = useConnections();
  const connectors = useConnectors();
  const { connectAsync } = useConnect();
  const { disconnectAsync, isPending: isDisconnecting } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const [pendingConnectorId, setPendingConnectorId] = useState<string>();
  const [switchTargetChainId, setSwitchTargetChainId] = useState<number>();
  const [message, setMessage] = useState<string>();
  const [copied, setCopied] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useSyncWalletChain(connection);

  const normalizedAddress =
    connection.address && isAddress(connection.address)
      ? getAddress(connection.address)
      : undefined;
  const currentNetwork = getSupportedNetwork(connection.chainId);
  const isConnected = connection.status === "connected" && !!normalizedAddress;
  const isResolving =
    !hydrated || walletRestorePending || connection.status === "reconnecting";

  const availableConnectors = useMemo(() => {
    if (!hydrated) return [];
    const discovered = connectors.filter((connector) => connector.id !== "injected");
    if (discovered.length > 0) return discovered;
    const hasLegacyProvider = typeof window !== "undefined" && "ethereum" in window;
    return hasLegacyProvider
      ? connectors.filter((connector) => connector.id === "injected")
      : [];
  }, [connectors, hydrated]);

  const closeSurface = useCallback(() => {
    setOpen(false);
    setMessage(undefined);
    setCopied(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSurface();
    };
    document.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() =>
      dialogRef.current
        ?.querySelector<HTMLElement>("[data-dialog-initial-focus]")
        ?.focus(),
    );
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeSurface, open]);

  async function handleConnect(connector: Connector) {
    if (pendingConnectorId) return;
    setPendingConnectorId(connector.uid);
    setMessage(undefined);
    try {
      await connectAsync({ connector });
      closeSurface();
    } catch (error) {
      setMessage(
        classifyWalletError(error) === "user_rejected"
          ? "Connection cancelled. Nothing was submitted."
          : "The wallet couldn’t complete that request. Nothing was submitted.",
      );
    } finally {
      setPendingConnectorId(undefined);
    }
  }

  async function handleSwitch(chainId: SupportedChainId) {
    if (chainId === connection.chainId || switchTargetChainId) return;
    setSwitchTargetChainId(chainId);
    setMessage(undefined);
    const target =
      chainId === releaseConfig.creditcoin.id
        ? releaseConfig.creditcoin
        : releaseConfig.foreign;
    try {
      await switchChainAsync({ chainId });
      if (wagmiConfig.state.chainId !== chainId) {
        setMessage(
          `Your wallet hasn’t switched to ${target.name} yet. No economic state was assumed to change.`,
        );
      }
    } catch (error) {
      const kind = classifyWalletError(error);
      if (kind === "user_rejected") {
        setMessage(
          `Network switch cancelled. Your wallet is still on ${getNetworkName(connection.chainId)}.`,
        );
      } else if (kind === "switch_unavailable") {
        setMessage(
          `Switch your wallet to ${target.name} (chain ID ${target.id}), then try again.`,
        );
      } else {
        setMessage(
          "Mozy couldn’t change the network. No economic state was assumed to change. Try again.",
        );
      }
    } finally {
      setSwitchTargetChainId(undefined);
    }
  }

  async function handleCopyAddress() {
    if (!normalizedAddress) return;
    try {
      await navigator.clipboard.writeText(normalizedAddress);
      setCopied(true);
      setMessage(undefined);
    } catch {
      setMessage("The address couldn’t be copied. Select it below and copy it manually.");
    }
  }

  async function handleDisconnect() {
    if (isDisconnecting) return;
    setMessage(undefined);

    try {
      for (const activeConnection of connections) {
        await disconnectAsync({ connector: activeConnection.connector });
      }
      await wagmiConfig.storage?.removeItem("recentConnectorId");
      closeSurface();
    } catch {
      setMessage(
        "Mozy couldn’t disconnect this wallet. Your connection is unchanged. Try again.",
      );
    }
  }

  const triggerLabel = isConnected
    ? currentNetwork?.name ?? "Unsupported network"
    : "Connect wallet";

  return (
    <div className="w-full max-w-[184px] lg:max-w-none">
      {isResolving ? (
        <div
          className="h-11 w-full animate-pulse rounded-control border border-line bg-wash motion-reduce:animate-none"
          aria-label="Restoring wallet connection"
        />
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-control border border-line-strong bg-paper px-3 text-left outline-none transition-colors hover:bg-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
        >
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium text-ink">
              {triggerLabel}
            </span>
            {isConnected ? (
              <span className="block truncate font-mono text-[10px] text-ink-tertiary">
                {normalizedAddress.slice(0, 6)}…{normalizedAddress.slice(-4)}
              </span>
            ) : null}
          </span>
          <span className="h-2 w-2 shrink-0 border border-line-emphasis bg-paper" aria-hidden="true" />
        </button>
      )}

      {hydrated
        ? createPortal(
            <AnimatePresence initial={false}>
              {open ? (
          <m.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-ink/20 p-3 sm:items-center sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.14 }}
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) closeSurface();
            }}
          >
            <m.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="wallet-surface-title"
              className="max-h-[calc(100vh-24px)] w-full max-w-[420px] overflow-y-auto rounded-control border border-line-strong bg-paper-raised shadow-control"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
            >
              <div className="flex min-h-14 items-center justify-between border-b border-line px-4">
                <h2 id="wallet-surface-title" className="text-base font-medium">
                  {isConnected ? "Account" : "Connect wallet"}
                </h2>
                <button
                  data-dialog-initial-focus
                  type="button"
                  onClick={closeSurface}
                  className="flex h-11 w-11 items-center justify-center rounded-control text-ink-secondary outline-none hover:bg-wash focus-visible:outline-2 focus-visible:outline-signal"
                  aria-label="Close wallet controls"
                >
                  <IoCloseOutline aria-hidden="true" className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4 sm:p-5">
                {isConnected ? (
                  <>
                    <div className="border-b border-line pb-5">
                      <p className="text-sm font-medium">
                        {currentNetwork?.name ?? "Unsupported network"}
                      </p>
                      <p className="mt-1 text-xs text-ink-tertiary">
                        {currentNetwork?.role ??
                          (connection.chainId
                            ? `This network is not supported by Mozy. Your wallet reported chain ID ${connection.chainId}.`
                            : "This network is not supported by Mozy.")}
                      </p>
                      <div className="mt-4 flex min-w-0 items-center gap-2 border border-line bg-wash px-3 py-2">
                        <span className="min-w-0 flex-1 select-all truncate font-mono text-xs" title={normalizedAddress}>
                          {normalizedAddress}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyAddress}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control outline-none hover:bg-wash-strong focus-visible:outline-2 focus-visible:outline-signal"
                          aria-label="Copy address"
                        >
                          <IoCopyOutline aria-hidden="true" className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-2 min-h-4 text-xs text-success" aria-live="polite">
                        {copied ? "Address copied" : ""}
                      </p>
                    </div>

                    {!currentNetwork ? (
                      <p className="mt-5 border-l-2 border-signal pl-3 text-sm leading-5 text-ink-secondary">
                        Switch to Creditcoin CC3 Testnet to continue with settlement actions.
                      </p>
                    ) : null}

                    <div className="mt-5">
                      <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-ink-tertiary">
                        Switch network
                      </h3>
                      <div className="mt-3 divide-y divide-line border-y border-line">
                        {[releaseConfig.creditcoin, releaseConfig.foreign].map((network) => {
                          const active = connection.chainId === network.id;
                          const pending = switchTargetChainId === network.id;
                          return (
                            <button
                              key={network.id}
                              type="button"
                              onClick={() => handleSwitch(network.id)}
                              disabled={active || !!switchTargetChainId}
                              className="flex min-h-14 w-full items-center justify-between gap-4 px-1 text-left outline-none hover:bg-wash disabled:cursor-not-allowed disabled:text-ink-tertiary focus-visible:bg-wash focus-visible:outline-2 focus-visible:outline-signal"
                            >
                              <span>
                                <span className="block text-sm font-medium">{network.name}</span>
                                <span className="block text-xs text-ink-tertiary">{network.role}</span>
                              </span>
                              <span className="font-mono text-[10px]">
                                {pending ? "Waiting for wallet" : active ? "Current" : network.id}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDisconnect}
                      disabled={isDisconnecting}
                      className="mt-5 min-h-11 w-full rounded-control border border-line-strong px-4 text-sm font-medium outline-none hover:bg-wash disabled:cursor-wait disabled:text-ink-tertiary focus-visible:outline-2 focus-visible:outline-signal"
                    >
                      {isDisconnecting ? "Disconnecting" : "Disconnect"}
                    </button>
                  </>
                ) : availableConnectors.length > 0 ? (
                  <div className="divide-y divide-line border-y border-line">
                    {availableConnectors.map((connector) => {
                      const pending = pendingConnectorId === connector.uid;
                      return (
                        <button
                          key={connector.uid}
                          type="button"
                          onClick={() => handleConnect(connector)}
                          disabled={!!pendingConnectorId}
                          className="flex min-h-14 w-full items-center justify-between gap-4 px-1 text-left text-sm font-medium outline-none hover:bg-wash disabled:cursor-wait disabled:text-ink-tertiary focus-visible:bg-wash focus-visible:outline-2 focus-visible:outline-signal"
                        >
                          <span>{connector.name}</span>
                          <span className="text-xs font-normal text-ink-tertiary">
                            {pending ? "Waiting for wallet" : "Connect"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-ink-secondary">
                    No compatible wallet found. Open Mozy in an EVM wallet browser or install one to continue.
                  </p>
                )}

                {message ? (
                  <p
                    className="mt-4 border-l-2 border-error pl-3 text-sm leading-5 text-error"
                    role="alert"
                  >
                    {message}
                  </p>
                ) : null}
              </div>
            </m.div>
          </m.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  );
}
