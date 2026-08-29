"use client";

import { releaseConfig } from "@mozy/chain-config";
import { useQuery } from "@tanstack/react-query";
import { getAddress, type Address } from "viem";
import { usePublicClient } from "wagmi";
import {
  marketAbi,
  reservationCreatedEvent,
} from "@/lib/acquisition-contracts";
import type { Mandate, Reservation } from "@/features/acquisitions/types";

const LOG_CHUNK_SIZE = 50_000n;
const MAX_DIRECT_RESERVATIONS = 128;
const READ_BATCH_SIZE = 8;

export type SolverReservationRow = {
  reservation: Reservation;
  mandate: Mandate;
};

export function useSolverReservations(solver?: Address) {
  const client = usePublicClient({ chainId: releaseConfig.creditcoin.id });
  return useQuery({
    queryKey: ["solver-reservations", releaseConfig.configVersion, solver],
    enabled: !!client && !!solver,
    retry: false,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<SolverReservationRow[]> => {
      if (!client || !solver) return [];
      const snapshotBlock = await client.getBlockNumber();
      const ids = new Set<bigint>();
      const indexed = await fetch(`/api/solver/${solver}/reservations`)
        .then(async (response) =>
          response.ok
            ? (response.json() as Promise<{
                reservationIds?: string[];
                projectionFreshness?: "fresh" | "refreshing";
              }>)
            : undefined,
        )
        .catch(() => undefined);
      for (const id of indexed?.reservationIds ?? []) {
        if (/^[1-9]\d*$/.test(id)) ids.add(BigInt(id));
      }
      if (!indexed || indexed.projectionFreshness !== "fresh") {
        for (
          let fromBlock = releaseConfig.deploymentBlock;
          fromBlock <= snapshotBlock;
          fromBlock += LOG_CHUNK_SIZE
        ) {
          const toBlock =
            fromBlock + LOG_CHUNK_SIZE - 1n > snapshotBlock
              ? snapshotBlock
              : fromBlock + LOG_CHUNK_SIZE - 1n;
          const logs = await client.getLogs({
            address: releaseConfig.contracts.market,
            event: reservationCreatedEvent,
            args: { solver },
            fromBlock,
            toBlock,
            strict: true,
          });
          for (const log of logs)
            if (log.args.reservationId !== undefined)
              ids.add(log.args.reservationId);
          if (ids.size > MAX_DIRECT_RESERVATIONS)
            throw new Error("Reservation discovery limit reached");
        }
      }
      const discovered = [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      const rows: SolverReservationRow[] = [];
      for (let index = 0; index < discovered.length; index += READ_BATCH_SIZE) {
        const batch = discovered.slice(index, index + READ_BATCH_SIZE);
        const values = await Promise.all(
          batch.map(async (id) => {
            const reservation = (await client.readContract({
              address: releaseConfig.contracts.market,
              abi: marketAbi,
              functionName: "getReservation",
              args: [id],
              blockNumber: snapshotBlock,
            })) as Reservation;
            if (getAddress(reservation.solver) !== getAddress(solver))
              throw new Error("Reservation solver mismatch");
            const mandate = (await client.readContract({
              address: releaseConfig.contracts.market,
              abi: marketAbi,
              functionName: "getMandate",
              args: [reservation.mandateId],
              blockNumber: snapshotBlock,
            })) as Mandate;
            return { reservation, mandate };
          }),
        );
        rows.push(...values);
      }
      return rows.sort((a, b) =>
        a.reservation.deliveryDeadline < b.reservation.deliveryDeadline
          ? -1
          : a.reservation.deliveryDeadline > b.reservation.deliveryDeadline
            ? 1
            : a.reservation.id < b.reservation.id
              ? -1
              : 1,
      );
    },
  });
}
