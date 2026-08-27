"use client";

import { useQuery } from "@tanstack/react-query";
import { releaseConfig } from "@mozy/chain-config";
import { usePublicClient } from "wagmi";
import { marketAbi, vaultAbi } from "@/lib/acquisition-contracts";
import type { Acquisition, Mandate, VaultAccount } from "./types";

export function useAcquisition(mandateId?: bigint) {
  const client = usePublicClient({ chainId: releaseConfig.creditcoin.id });
  return useQuery({
    queryKey: ["acquisition", releaseConfig.configVersion, releaseConfig.creditcoin.id, mandateId?.toString()],
    enabled: !!client && !!mandateId,
    queryFn: async (): Promise<Acquisition> => {
      if (!client || !mandateId) throw new Error("Acquisition unavailable");
      const [mandate, account] = await Promise.all([
        client.readContract({ address: releaseConfig.contracts.market, abi: marketAbi, functionName: "getMandate", args: [mandateId] }),
        client.readContract({ address: releaseConfig.contracts.vault, abi: vaultAbi, functionName: "getAccount", args: [mandateId] }),
      ]);
      return { mandate: mandate as Mandate, account: account as VaultAccount };
    },
  });
}
