"use client";

import { releaseConfig } from "@mozy/chain-config";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { marketAbi, reservationCreatedEvent } from "@/lib/acquisition-contracts";
import type { Reservation } from "../types";

const LOG_CHUNK_SIZE = 50_000n;
const MAX_DIRECT_RESERVATIONS = 128;
const READ_BATCH_SIZE = 8;

async function discoverReservationIds(
  client: NonNullable<ReturnType<typeof usePublicClient>>,
  mandateId: bigint,
  snapshotBlock: bigint,
) {
  const ids = new Set<bigint>();
  for (
    let fromBlock = releaseConfig.deploymentBlock;
    fromBlock <= snapshotBlock;
    fromBlock += LOG_CHUNK_SIZE
  ) {
    const toBlock = fromBlock + LOG_CHUNK_SIZE - 1n > snapshotBlock
      ? snapshotBlock
      : fromBlock + LOG_CHUNK_SIZE - 1n;
    const logs = await client.getLogs({
      address: releaseConfig.contracts.market,
      event: reservationCreatedEvent,
      args: { mandateId },
      fromBlock,
      toBlock,
      strict: true,
    });
    for (const log of logs) {
      if (log.args.mandateId === mandateId && log.args.reservationId !== undefined) {
        ids.add(log.args.reservationId);
      }
    }
    if (ids.size > MAX_DIRECT_RESERVATIONS) throw new Error("Reservation detail limit reached");
  }
  return [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function useMandateReservations({
  mandateId,
  snapshotBlock,
}: {
  mandateId: bigint;
  snapshotBlock?: bigint;
}) {
  const client = usePublicClient({ chainId: releaseConfig.creditcoin.id });
  return useQuery({
    queryKey: [
      "mandate-reservations",
      releaseConfig.configVersion,
      releaseConfig.creditcoin.id,
      mandateId.toString(),
      snapshotBlock?.toString(),
    ],
    enabled: !!client && snapshotBlock !== undefined,
    placeholderData: (previous) => previous,
    retry: false,
    queryFn: async (): Promise<Reservation[]> => {
      if (!client || snapshotBlock === undefined) throw new Error("Reservation details unavailable");
      const ids = await discoverReservationIds(client, mandateId, snapshotBlock);
      const reservations: Reservation[] = [];
      for (let index = 0; index < ids.length; index += READ_BATCH_SIZE) {
        const batch = ids.slice(index, index + READ_BATCH_SIZE);
        const values = await Promise.all(batch.map((reservationId) => client.readContract({
          address: releaseConfig.contracts.market,
          abi: marketAbi,
          functionName: "getReservation",
          args: [reservationId],
          blockNumber: snapshotBlock,
        })));
        reservations.push(...values as Reservation[]);
      }
      return reservations.filter((reservation) =>
        reservation.mandateId === mandateId && reservation.status === 0
      );
    },
  });
}
