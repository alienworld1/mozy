"use client";

import { releaseConfig } from "@mozy/chain-config";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { Hash } from "viem";
import { useConnection, usePublicClient, useWalletClient } from "wagmi";
import type { TransactionPhase } from "@/components/states/TransactionState";
import { chainInfoAbi, marketAbi } from "@/lib/acquisition-contracts";
import { classifyWalletError } from "@/lib/wallet-errors";
import type { Reservation } from "@/features/acquisitions/types";

export function useExpireReservation(reservationId: bigint, onConfirmed: () => void) {
  const connection = useConnection();
  const client = usePublicClient({ chainId: releaseConfig.creditcoin.id });
  const wallet = useWalletClient({ chainId: releaseConfig.creditcoin.id });
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<TransactionPhase>("idle");
  const [hash, setHash] = useState<Hash>();
  const [message, setMessage] = useState<string>();
  const [uncertain, setUncertain] = useState(false);

  const expire = useCallback(async () => {
    if (!client || !wallet.data || !connection.address || connection.chainId !== releaseConfig.creditcoin.id)
      return;
    let broadcastHash: Hash | undefined;
    let receiptKnown = false;
    setPhase("awaiting_wallet");
    setMessage(undefined);
    setHash(undefined);
    setUncertain(false);
    try {
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
        }),
      ]);
      if (reservation.status !== 0) {
        onConfirmed();
        setPhase("canonical_confirmed");
        setMessage("This reservation has already been resolved.");
        return;
      }
      if (block.timestamp < reservation.deliveryDeadline || !chainInfo[3] || chainInfo[0] < reservation.expiryEligibleHeight)
        throw new Error("not_eligible");
      const simulation = await client.simulateContract({
        account: connection.address,
        address: releaseConfig.contracts.market,
        abi: marketAbi,
        functionName: "expireReservation",
        args: [reservationId],
      });
      broadcastHash = await wallet.data.writeContract(simulation.request);
      setHash(broadcastHash);
      setPhase("submitted");
      setMessage("Reservation release submitted. No duplicate action will be sent while this transaction is unresolved.");
      setPhase("confirming");
      const receipt = await client.waitForTransactionReceipt({ hash: broadcastHash });
      receiptKnown = true;
      if (receipt.status !== "success") throw new Error("reverted");
      const confirmed = (await client.readContract({
        address: releaseConfig.contracts.market,
        abi: marketAbi,
        functionName: "getReservation",
        args: [reservationId],
      })) as Reservation;
      if (confirmed.status !== 1) throw new Error("readback_failed");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reservation-workspace", releaseConfig.configVersion] }),
        queryClient.invalidateQueries({ queryKey: ["solver-reservations", releaseConfig.configVersion] }),
        queryClient.invalidateQueries({ queryKey: ["mandate-reservations", releaseConfig.configVersion] }),
        queryClient.invalidateQueries({ queryKey: ["acquisition-snapshot", releaseConfig.configVersion] }),
        queryClient.invalidateQueries({ queryKey: ["acquisition", releaseConfig.configVersion] }),
        queryClient.invalidateQueries({ queryKey: ["reservation-verification", reservationId.toString()] }),
        queryClient.invalidateQueries({ queryKey: ["activity"] }),
      ]);
      setPhase("canonical_confirmed");
      setMessage("Reserved quantity and payout were released. The reservation bond was forfeited to the buyer.");
      onConfirmed();
    } catch (error) {
      if (broadcastHash && !receiptKnown) {
        setPhase("submitted");
        setUncertain(true);
        setMessage("Transaction status is uncertain. Check the transaction before trying again.");
        return;
      }
      const latest = client
        ? ((await client.readContract({
            address: releaseConfig.contracts.market,
            abi: marketAbi,
            functionName: "getReservation",
            args: [reservationId],
          }).catch(() => undefined)) as Reservation | undefined)
        : undefined;
      if (latest?.status === 1) {
        setPhase("canonical_confirmed");
        setMessage("This reservation was released by another transaction.");
        onConfirmed();
        return;
      }
      setPhase("rejected");
      setMessage(
        classifyWalletError(error) === "user_rejected"
          ? "Transaction cancelled. Nothing was submitted. Reservation and locked economics are unchanged."
          : error instanceof Error && error.message === "not_eligible"
            ? "This reservation cannot be released yet because the final delivery blocks are still becoming verifiable."
            : "Reservation R" + reservationId.toString() + " was not released. Its quantity, payout, and bond remain locked. Refresh confirmed state before trying again.",
      );
    }
  }, [client, connection.address, connection.chainId, onConfirmed, queryClient, reservationId, wallet.data]);

  return {
    expire,
    phase,
    hash,
    message,
    pending: uncertain || ["awaiting_wallet", "submitted", "confirming"].includes(phase),
  };
}
