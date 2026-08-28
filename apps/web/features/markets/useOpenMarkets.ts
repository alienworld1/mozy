"use client";

import { releaseConfig } from "@mozy/chain-config";
import { useQuery } from "@tanstack/react-query";
import { getAddress } from "viem";
import { usePublicClient } from "wagmi";
import {
  mandateCreatedEvent,
  marketAbi,
  registryAbi,
  vaultAbi,
} from "@/lib/acquisition-contracts";
import type {
  Acquisition,
  Mandate,
  ReservationQuote,
  VaultAccount,
} from "@/features/acquisitions/types";
import type { ExecutableMarketRow } from "./types";

const LOG_CHUNK_SIZE = 50_000n;
const MAX_MARKETS = 128;
const READ_BATCH_SIZE = 8;

export class MarketDiscoveryLimitError extends Error {}

export function isExecutableAcquisition(acquisition: Acquisition, now: bigint) {
  const { mandate, account } = acquisition;
  if (
    mandate.status !== 1 ||
    mandate.marketId !== BigInt(releaseConfig.marketId)
  )
    return false;
  if (mandate.acquiredAmount + mandate.reservedAmount > mandate.targetAmount)
    return false;
  if (getAddress(account.token) !== releaseConfig.settlementToken.address)
    return false;
  if (account.funded !== mandate.requiredFunding) return false;
  if (
    account.funded !==
    account.spent + account.reserved + account.free + account.refunded
  )
    return false;
  const openAmount =
    mandate.targetAmount - mandate.acquiredAmount - mandate.reservedAmount;
  return (
    openAmount > 0n &&
    account.free > 0n &&
    mandate.mandateExpiry > now + mandate.reservationDuration
  );
}

export function useOpenMarkets() {
  const client = usePublicClient({ chainId: releaseConfig.creditcoin.id });
  return useQuery({
    queryKey: [
      "open-markets",
      releaseConfig.configVersion,
      releaseConfig.creditcoin.id,
    ],
    enabled: !!client,
    retry: false,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<ExecutableMarketRow[]> => {
      if (!client) throw new Error("Markets unavailable");
      const block = await client.getBlock();
      const ids = new Map<string, { id: bigint; blockNumber: bigint }>();
      for (
        let fromBlock = releaseConfig.deploymentBlock;
        fromBlock <= block.number;
        fromBlock += LOG_CHUNK_SIZE
      ) {
        const toBlock =
          fromBlock + LOG_CHUNK_SIZE - 1n > block.number
            ? block.number
            : fromBlock + LOG_CHUNK_SIZE - 1n;
        const logs = await client.getLogs({
          address: releaseConfig.contracts.market,
          event: mandateCreatedEvent,
          args: { marketId: BigInt(releaseConfig.marketId) },
          fromBlock,
          toBlock,
          strict: true,
        });
        for (const log of logs) {
          if (log.args.mandateId !== undefined)
            ids.set(log.args.mandateId.toString(), {
              id: log.args.mandateId,
              blockNumber: log.blockNumber,
            });
        }
        if (ids.size > MAX_MARKETS)
          throw new MarketDiscoveryLimitError("Market discovery limit reached");
      }

      const marketConfig = await client.readContract({
        address: releaseConfig.contracts.registry,
        abi: registryAbi,
        functionName: "getMarket",
        args: [BigInt(releaseConfig.marketId)],
        blockNumber: block.number,
      });
      if (
        !marketConfig.enabled ||
        getAddress(marketConfig.foreignToken) !==
          releaseConfig.deliveryToken.address ||
        getAddress(marketConfig.settlementToken) !==
          releaseConfig.settlementToken.address
      )
        return [];

      const discovered = [...ids.values()];
      const rows: ExecutableMarketRow[] = [];
      let readFailed = false;
      for (let index = 0; index < discovered.length; index += READ_BATCH_SIZE) {
        const batch = discovered.slice(index, index + READ_BATCH_SIZE);
        const values = await Promise.all(
          batch.map(async ({ id, blockNumber }) => {
            try {
              const [mandate, account] = await Promise.all([
                client.readContract({
                  address: releaseConfig.contracts.market,
                  abi: marketAbi,
                  functionName: "getMandate",
                  args: [id],
                  blockNumber: block.number,
                }),
                client.readContract({
                  address: releaseConfig.contracts.vault,
                  abi: vaultAbi,
                  functionName: "getAccount",
                  args: [id],
                  blockNumber: block.number,
                }),
              ]);
              const acquisition: Acquisition = {
                mandate: mandate as Mandate,
                account: account as VaultAccount,
                snapshotBlock: block.number,
                creationBlock: blockNumber,
              };
              if (!isExecutableAcquisition(acquisition, block.timestamp))
                return undefined;
              const openAmount =
                mandate.targetAmount -
                mandate.acquiredAmount -
                mandate.reservedAmount;
              const unit = 10n ** BigInt(releaseConfig.deliveryToken.decimals);
              const indicationQuantity = openAmount < unit ? openAmount : unit;
              const quote = await client.readContract({
                address: releaseConfig.contracts.market,
                abi: marketAbi,
                functionName: "quoteReservation",
                args: [id, indicationQuantity],
                blockNumber: block.number,
              });
              const indication = {
                ...quote,
                quotedAtBlock: block.number,
                quotedAtTimestamp: block.timestamp,
              } as ReservationQuote;
              if (
                indication.eligibility !== 0 ||
                indication.payout > account.free
              )
                return undefined;
              return {
                acquisition,
                openAmount,
                indicationQuantity,
                indication,
              } satisfies ExecutableMarketRow;
            } catch {
              readFailed = true;
              return undefined;
            }
          }),
        );
        rows.push(
          ...values.filter(
            (value): value is ExecutableMarketRow => value !== undefined,
          ),
        );
      }
      if (readFailed)
        throw new Error("Some market details could not be loaded");
      return rows.sort((a, b) =>
        a.acquisition.mandate.mandateExpiry <
        b.acquisition.mandate.mandateExpiry
          ? -1
          : a.acquisition.mandate.mandateExpiry >
              b.acquisition.mandate.mandateExpiry
            ? 1
            : a.acquisition.mandate.id < b.acquisition.mandate.id
              ? -1
              : 1,
      );
    },
  });
}
