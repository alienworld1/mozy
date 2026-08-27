"use client";

import { useQuery } from "@tanstack/react-query";
import { releaseConfig } from "@mozy/chain-config";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { erc20Abi } from "@/lib/acquisition-contracts";

export function useFundingReadiness(buyer?: Address, enabled = false) {
  const client = usePublicClient({ chainId: releaseConfig.creditcoin.id });
  return useQuery({
    queryKey: ["funding-readiness", releaseConfig.configVersion, buyer],
    enabled: !!client && !!buyer && enabled,
    queryFn: async () => {
      if (!client || !buyer) throw new Error("Funding readiness unavailable");
      const [balance, allowance] = await Promise.all([
        client.readContract({ address: releaseConfig.settlementToken.address, abi: erc20Abi, functionName: "balanceOf", args: [buyer] }),
        client.readContract({ address: releaseConfig.settlementToken.address, abi: erc20Abi, functionName: "allowance", args: [buyer, releaseConfig.contracts.vault] }),
      ]);
      return { balance, allowance };
    },
  });
}
