"use client";

import { releaseConfig } from "@mozy/chain-config";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { marketAbi } from "@/lib/acquisition-contracts";
import type { FillQuote, InstrumentModel, Mandate } from "../types";

export class ChangedAcquisitionError extends Error {}

export function useFillQuote({
  mandateId,
  model,
  quantity,
  enabled,
}: {
  mandateId: bigint;
  model: InstrumentModel;
  quantity?: bigint;
  enabled: boolean;
}) {
  const client = usePublicClient({ chainId: releaseConfig.creditcoin.id });
  return useQuery({
    queryKey: [
      "fill-quote",
      releaseConfig.configVersion,
      releaseConfig.creditcoin.id,
      mandateId.toString(),
      model.snapshotBlock.toString(),
      quantity?.toString(),
    ],
    enabled: !!client && enabled && quantity !== undefined,
    retry: false,
    queryFn: async (): Promise<FillQuote> => {
      if (!client || quantity === undefined) throw new Error("Quote unavailable");
      const quotedAtBlock = await client.getBlockNumber();
      const [quote, freshMandate] = await Promise.all([
        client.readContract({
          address: releaseConfig.contracts.market,
          abi: marketAbi,
          functionName: "quoteMandate",
          args: [mandateId, quantity],
          blockNumber: quotedAtBlock,
        }),
        client.readContract({
          address: releaseConfig.contracts.market,
          abi: marketAbi,
          functionName: "getMandate",
          args: [mandateId],
          blockNumber: quotedAtBlock,
        }),
      ]);
      const mandate = freshMandate as Mandate;
      const [startPosition, payout, endPosition] = quote;
      const freshPosition = mandate.acquiredAmount + mandate.reservedAmount;
      if (
        mandate.status !== 1 ||
        mandate.targetAmount !== model.targetQuantity ||
        freshPosition !== model.currentPosition ||
        startPosition !== freshPosition ||
        endPosition !== startPosition + quantity ||
        endPosition > mandate.targetAmount
      ) {
        throw new ChangedAcquisitionError();
      }
      return { quantity, startPosition, payout, endPosition, quotedAtBlock };
    },
  });
}
