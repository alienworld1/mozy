"use client";

import { releaseConfig } from "@mozy/chain-config";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { erc20Abi } from "@/lib/acquisition-contracts";

export function useBondReadiness(solver?: Address, enabled = false) {
  const client = usePublicClient({ chainId: releaseConfig.creditcoin.id });
  return useQuery({
    queryKey: ["bond-readiness", releaseConfig.configVersion, solver],
    enabled: !!client && !!solver && enabled,
    queryFn: async () => {
      if (!client || !solver) throw new Error("Bond readiness unavailable");
      const [balance, allowance] = await Promise.all([
        client.readContract({
          address: releaseConfig.settlementToken.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [solver],
        }),
        client.readContract({
          address: releaseConfig.settlementToken.address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [solver, releaseConfig.contracts.vault],
        }),
      ]);
      return { balance, allowance };
    },
  });
}
