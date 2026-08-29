"use client";

import { releaseConfig } from "@mozy/chain-config";
import { useQuery } from "@tanstack/react-query";
import { getAddress } from "viem";
import { usePublicClient } from "wagmi";
import { chainInfoAbi, marketAbi } from "@/lib/acquisition-contracts";
import { getExpiryReadiness, type ExpiryReadiness } from "./reservation-recovery";
import type {
  Mandate,
  Reservation,
  ReservationRequirements,
} from "@/features/acquisitions/types";

export type ReservationWorkspaceData = {
  reservation: Reservation;
  requirements: ReservationRequirements;
  mandate: Mandate;
  snapshotBlock: bigint;
  chainTimestamp: bigint;
  latestAttestedHeight: bigint | null;
  expiryReadiness: ExpiryReadiness;
};

export function useReservationWorkspace(reservationId: bigint) {
  const client = usePublicClient({ chainId: releaseConfig.creditcoin.id });
  return useQuery({
    queryKey: [
      "reservation-workspace",
      releaseConfig.configVersion,
      reservationId.toString(),
    ],
    enabled: !!client,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    queryFn: async (): Promise<ReservationWorkspaceData> => {
      if (!client) throw new Error("Reservation unavailable");
      const snapshotBlock = await client.getBlockNumber();
      const [reservation, block, chainInfo] = await Promise.all([
        client.readContract({
          address: releaseConfig.contracts.market,
          abi: marketAbi,
          functionName: "getReservation",
          args: [reservationId],
          blockNumber: snapshotBlock,
        }) as Promise<Reservation>,
        client.getBlock({ blockNumber: snapshotBlock }),
        client.readContract({
          address: releaseConfig.contracts.chainInfo,
          abi: chainInfoAbi,
          functionName: "get_latest_attestation_height_and_hash",
          args: [releaseConfig.foreign.sourceChainKey],
          blockNumber: snapshotBlock,
        }).catch(() => null),
      ]);
      const [rawRequirements, mandate] = await Promise.all([
        client.readContract({
          address: releaseConfig.contracts.market,
          abi: marketAbi,
          functionName: "getReservationRequirements",
          args: [reservationId],
          blockNumber: snapshotBlock,
        }),
        client.readContract({
          address: releaseConfig.contracts.market,
          abi: marketAbi,
          functionName: "getMandate",
          args: [reservation.mandateId],
          blockNumber: snapshotBlock,
        }),
      ]);
      const [market, deliveryWallet, settlementToken] = rawRequirements;
      const requirements = {
        market,
        deliveryWallet,
        settlementToken,
      } as ReservationRequirements;
      if (
        reservation.id !== reservationId ||
        mandate.id !== reservation.mandateId ||
        getAddress(requirements.market.foreignToken) !==
          releaseConfig.deliveryToken.address ||
        getAddress(requirements.market.settlementToken) !==
          releaseConfig.settlementToken.address ||
        getAddress(requirements.settlementToken) !==
          releaseConfig.settlementToken.address ||
        getAddress(requirements.deliveryWallet) !==
          getAddress(mandate.deliveryWallet) ||
        requirements.market.foreignTokenDecimals !==
          releaseConfig.deliveryToken.decimals ||
        requirements.market.settlementTokenDecimals !==
          releaseConfig.settlementToken.decimals ||
        !requirements.market.enabled ||
        requirements.market.sourceChainKey <= 0n
      )
        throw new Error(
          "Reservation requirements do not match the release market",
        );
      return {
        reservation,
        requirements,
        mandate: mandate as Mandate,
        snapshotBlock,
        chainTimestamp: block.timestamp,
        latestAttestedHeight:
          chainInfo && chainInfo[3] ? chainInfo[0] : null,
        expiryReadiness: getExpiryReadiness({
          status: reservation.status,
          chainTimestamp: block.timestamp,
          deliveryDeadline: reservation.deliveryDeadline,
          latestAttestedHeight: chainInfo && chainInfo[3] ? chainInfo[0] : null,
          expiryEligibleHeight: reservation.expiryEligibleHeight,
        }),
      };
    },
  });
}
