"use client";

import { releaseConfig } from "@mozy/chain-config";
import { useEffect, useMemo, useState } from "react";
import { useHydrated } from "@/hooks/useHydrated";
import { formatExactTokenAmount } from "../format";
import { mandateStatuses, type InstrumentModel, type Mandate } from "../types";
import { validateMeasurement } from "./instrument-model";
import { ChangedAcquisitionError, useFillQuote } from "./useFillQuote";

export function useFillMeasurement({
  mandate,
  model,
  accountingVerified,
  onAcquisitionRefresh,
}: {
  mandate: Mandate;
  model: InstrumentModel;
  accountingVerified: boolean;
  onAcquisitionRefresh: () => unknown;
}) {
  const hydrated = useHydrated();
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState<{ input: string; snapshotBlock: bigint; quantity: bigint }>();
  const [currentTime, setCurrentTime] = useState(() => BigInt(Math.floor(Date.now() / 1000)));
  const status = mandateStatuses[mandate.status];
  const expiredByTime = hydrated && mandate.mandateExpiry <= currentTime;
  const enabled = accountingVerified && status === "Open" && model.openQuantity > 0n && !expiredByTime;
  const validation = useMemo(() => validateMeasurement(
    input,
    releaseConfig.deliveryToken.decimals,
    releaseConfig.deliveryToken.symbol,
    model.openQuantity,
    formatExactTokenAmount(model.openQuantity, releaseConfig.deliveryToken.decimals),
  ), [input, model.openQuantity]);

  useEffect(() => {
    if (mandate.mandateExpiry <= currentTime) return;
    const remainingMs = Number((mandate.mandateExpiry - currentTime) * 1_000n);
    const timeout = window.setTimeout(
      () => setCurrentTime(BigInt(Math.floor(Date.now() / 1000))),
      Math.min(remainingMs + 250, 2_147_000_000),
    );
    return () => window.clearTimeout(timeout);
  }, [currentTime, mandate.mandateExpiry]);

  useEffect(() => {
    if (!enabled || validation.status !== "valid") return;
    const timeout = window.setTimeout(() => setDebounced({ input, snapshotBlock: model.snapshotBlock, quantity: validation.quantity }), 280);
    return () => window.clearTimeout(timeout);
  }, [enabled, input, model.snapshotBlock, validation]);

  const debouncedQuantity = debounced?.input === input && debounced.snapshotBlock === model.snapshotBlock
    ? debounced.quantity
    : undefined;

  const quoteQuery = useFillQuote({
    mandateId: mandate.id,
    model,
    quantity: debouncedQuantity,
    enabled,
  });

  useEffect(() => {
    if (quoteQuery.error instanceof ChangedAcquisitionError) void onAcquisitionRefresh();
  }, [onAcquisitionRefresh, quoteQuery.error]);

  let disabledMessage: string | undefined;
  if (!accountingVerified) disabledMessage = "This acquisition’s accounting could not be verified. Refresh before continuing.";
  else if (status === "Paused") disabledMessage = "New fill measurement is unavailable while this acquisition is paused.";
  else if (status === "Funding") disabledMessage = "This acquisition opens after funding is complete.";
  else if (status !== "Open") disabledMessage = "This acquisition is not accepting new fills.";
  else if (expiredByTime) disabledMessage = "This acquisition is no longer accepting new fills.";
  else if (model.openQuantity === 0n) disabledMessage = "No quantity remains open.";

  const waitingForDebounce = enabled && validation.status === "valid" && debouncedQuantity === undefined;
  return {
    input,
    setInput,
    validation,
    quote: quoteQuery.data,
    quoteError: quoteQuery.error,
    quoteLoading: waitingForDebounce || quoteQuery.isFetching,
    retryQuote: quoteQuery.refetch,
    enabled,
    disabledMessage,
  };
}
