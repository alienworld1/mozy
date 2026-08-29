"use client";

import { releaseConfig } from "@mozy/chain-config";
import { getAddress, type Hash } from "viem";
import { useConnection, useWalletClient } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import type { Reservation } from "@/features/acquisitions/types";
import {
  buildRegistrationStatement,
  type CandidateRecord,
  type UnsignedCandidateRegistration,
} from "./candidate-record";

export function useCandidateRegistration(reservation: Reservation) {
  const queryClient = useQueryClient();
  const connection = useConnection();
  const wallet = useWalletClient();
  async function register(
    transactionHash: Hash,
    source: "composer" | "external",
    replacesHash?: Hash,
  ): Promise<CandidateRecord> {
    if (reservation.status !== 0)
      throw new Error(
        "This reservation is no longer accepting delivery transactions.",
      );
    if (
      !connection.address ||
      getAddress(connection.address) !== getAddress(reservation.solver) ||
      !wallet.data
    )
      throw new Error(
        "Connect the reserved solver wallet to register this transaction.",
      );
    const issued = new Date();
    const unsigned: UnsignedCandidateRegistration = {
      configVersion: releaseConfig.configVersion,
      reservationId: reservation.id.toString(),
      solver: getAddress(reservation.solver),
      foreignChainId: releaseConfig.foreign.id,
      transactionHash,
      source,
      issuedAt: issued.toISOString(),
      expiresAt: new Date(issued.getTime() + 5 * 60 * 1_000).toISOString(),
      origin: window.location.origin,
      replacesHash,
    };
    const signature = await wallet.data.signMessage({
      account: getAddress(reservation.solver),
      message: buildRegistrationStatement(unsigned),
    });
    const response = await fetch(
      `/api/reservations/${reservation.id.toString()}/foreign-tx`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...unsigned, signature }),
      },
    );
    const result = (await response.json().catch(() => undefined)) as
      | { ok?: boolean; message?: string }
      | undefined;
    if (!response.ok || !result?.ok)
      throw new Error(
        result?.message ??
          "We couldn’t register this transaction. The foreign transfer is unchanged.",
      );
    await queryClient.invalidateQueries({
      queryKey: ["reservation-verification", reservation.id.toString()],
    });
    return {
      configVersion: releaseConfig.configVersion,
      reservationId: reservation.id.toString(),
      solver: getAddress(reservation.solver),
      foreignChainId: releaseConfig.foreign.id,
      transactionHash,
      source,
      localState: "registered",
      submittedAt: issued.toISOString(),
      replacesHash,
    };
  }
  return { register };
}
