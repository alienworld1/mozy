"use client";

import { useQuery } from "@tanstack/react-query";
import { releaseConfig } from "@mozy/chain-config";
import { usePublicClient } from "wagmi";
import { marketAbi, registryAbi } from "@/lib/acquisition-contracts";

export function useReleaseMarket() {
  const client = usePublicClient({ chainId: releaseConfig.creditcoin.id });
  return useQuery({
    queryKey: ["release-market", releaseConfig.configVersion, releaseConfig.creditcoin.id],
    enabled: !!client,
    queryFn: async () => {
      if (!client) throw new Error("Creditcoin connection unavailable");
      const [market, protocolPaused] = await Promise.all([
        client.readContract({ address: releaseConfig.contracts.registry, abi: registryAbi, functionName: "getMarket", args: [BigInt(releaseConfig.marketId)] }),
        client.readContract({ address: releaseConfig.contracts.market, abi: marketAbi, functionName: "protocolPaused" }),
      ]);
      return { market, protocolPaused };
    },
  });
}
