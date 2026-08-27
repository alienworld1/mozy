"use client";

import { releaseConfig } from "@mozy/chain-config";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";

export function useAcquisitionSnapshot(mandateId: bigint) {
  const client = usePublicClient({ chainId: releaseConfig.creditcoin.id });
  return useQuery({
    queryKey: ["acquisition-snapshot", releaseConfig.configVersion, releaseConfig.creditcoin.id, mandateId.toString()],
    enabled: !!client,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!client) throw new Error("Snapshot unavailable");
      return client.getBlockNumber();
    },
  });
}
