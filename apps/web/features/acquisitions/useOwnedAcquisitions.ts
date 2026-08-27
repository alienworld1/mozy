"use client";

import { useQuery } from "@tanstack/react-query";
import { releaseConfig } from "@mozy/chain-config";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { mandateCreatedEvent, marketAbi, vaultAbi } from "@/lib/acquisition-contracts";
import type { Acquisition, Mandate, OwnedAcquisitionResult, VaultAccount } from "./types";

export function useOwnedAcquisitions(buyer?: Address) {
  const client = usePublicClient({ chainId: releaseConfig.creditcoin.id });
  return useQuery({
    queryKey: ["owned-acquisitions", releaseConfig.configVersion, releaseConfig.creditcoin.id, buyer],
    enabled: !!client && !!buyer,
    queryFn: async (): Promise<OwnedAcquisitionResult[]> => {
      if (!client || !buyer) return [];
      const logs = await client.getLogs({
        address: releaseConfig.contracts.market,
        event: mandateCreatedEvent,
        args: { buyer },
        fromBlock: releaseConfig.deploymentBlock,
        toBlock: "latest",
        strict: true,
      });
      const unique = new Map<string, (typeof logs)[number]>();
      for (const log of logs) if (log.args.mandateId) unique.set(log.args.mandateId.toString(), log);
      const ordered = [...unique.values()].sort((a, b) => Number((b.blockNumber ?? 0n) - (a.blockNumber ?? 0n)) || (b.logIndex ?? 0) - (a.logIndex ?? 0));
      return Promise.all(ordered.map(async (log): Promise<OwnedAcquisitionResult> => {
        const mandateId = log.args.mandateId!;
        try {
          const [mandate, account] = await Promise.all([
            client.readContract({ address: releaseConfig.contracts.market, abi: marketAbi, functionName: "getMandate", args: [mandateId] }),
            client.readContract({ address: releaseConfig.contracts.vault, abi: vaultAbi, functionName: "getAccount", args: [mandateId] }),
          ]);
          const acquisition: Acquisition = { mandate: mandate as Mandate, account: account as VaultAccount, creationBlock: log.blockNumber, transactionHash: log.transactionHash };
          return { mandateId, acquisition };
        } catch {
          return { mandateId, unavailable: true };
        }
      }));
    },
  });
}
