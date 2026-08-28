"use client";

import { releaseConfig } from "@mozy/chain-config";
import { useCallback, useState } from "react";
import { getAddress, type Hash } from "viem";
import { useConnection, usePublicClient, useWalletClient } from "wagmi";
import type { TransactionPhase } from "@/components/states/TransactionState";
import { erc20Abi, marketAbi } from "@/lib/acquisition-contracts";
import { classifyWalletError } from "@/lib/wallet-errors";
import type { Reservation } from "@/features/acquisitions/types";
import type { ReservationWorkspaceData } from "./useReservationWorkspace";

export type DeliveryOutcome =
  | { hash: Hash; status: "confirmed"; blockNumber: bigint }
  | { hash: Hash; status: "uncertain" }
  | { hash?: Hash; status: "failed" };

export function useDeliveryTransaction(data: ReservationWorkspaceData) {
  const connection = useConnection();
  const creditcoin = usePublicClient({ chainId: releaseConfig.creditcoin.id });
  const foreign = usePublicClient({ chainId: releaseConfig.foreign.id });
  const wallet = useWalletClient({ chainId: releaseConfig.foreign.id });
  const [phase, setPhase] = useState<TransactionPhase>("idle");
  const [hash, setHash] = useState<Hash>();
  const [message, setMessage] = useState<string>();
  const [balance, setBalance] = useState<bigint>();
  const [checkingBalance, setCheckingBalance] = useState(false);

  const refreshBalance = useCallback(async () => {
    if (!foreign) return;
    setCheckingBalance(true);
    try {
      setBalance(
        await foreign.readContract({
          address: releaseConfig.deliveryToken.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [data.reservation.solver],
        }),
      );
    } finally {
      setCheckingBalance(false);
    }
  }, [data.reservation.solver, foreign]);

  const send = useCallback(
    async (onSubmitted: (hash: Hash) => void): Promise<DeliveryOutcome> => {
      if (
        !creditcoin ||
        !foreign ||
        !wallet.data ||
        !connection.address ||
        connection.chainId !== releaseConfig.foreign.id
      )
        return { status: "failed" };
      let broadcastHash: Hash | undefined;
      let receiptKnown = false;
      setPhase("awaiting_wallet");
      setMessage(undefined);
      setHash(undefined);
      try {
        const solver = getAddress(connection.address);
        const fresh = (await creditcoin.readContract({
          address: releaseConfig.contracts.market,
          abi: marketAbi,
          functionName: "getReservation",
          args: [data.reservation.id],
        })) as Reservation;
        if (
          fresh.status !== 0 ||
          getAddress(fresh.solver) !== solver ||
          fresh.quantity !== data.reservation.quantity
        )
          throw new Error("Reservation changed");
        const freshBalance = await foreign.readContract({
          address: releaseConfig.deliveryToken.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [solver],
        });
        setBalance(freshBalance);
        if (freshBalance < fresh.quantity)
          throw new Error("Insufficient TEST balance");
        const simulation = await foreign.simulateContract({
          account: solver,
          address: releaseConfig.deliveryToken.address,
          abi: erc20Abi,
          functionName: "transfer",
          args: [data.requirements.deliveryWallet, fresh.quantity],
        });
        const transactionHash = await wallet.data.writeContract(
          simulation.request,
        );
        broadcastHash = transactionHash;
        setHash(transactionHash);
        setPhase("submitted");
        setMessage(
          "Transaction submitted. Check this hash before sending again if confirmation is delayed.",
        );
        onSubmitted(transactionHash);
        setPhase("confirming");
        const receipt = await foreign.waitForTransactionReceipt({
          hash: transactionHash,
          timeout: 90_000,
        });
        receiptKnown = true;
        if (receipt.status !== "success") throw new Error("Transfer reverted");
        setPhase("delivery_submitted");
        setMessage("This transaction has not been verified or paid yet.");
        return {
          hash: transactionHash,
          status: "confirmed",
          blockNumber: receipt.blockNumber,
        };
      } catch (error) {
        if (broadcastHash && !receiptKnown) {
          setPhase("submitted");
          setMessage(
            "Transaction status is uncertain. Check it before sending again.",
          );
          return { hash: broadcastHash, status: "uncertain" };
        }
        setPhase("rejected");
        const rejected = classifyWalletError(error) === "user_rejected";
        setMessage(
          rejected
            ? "Transaction cancelled. Nothing was submitted."
            : error instanceof Error &&
                error.message === "Insufficient TEST balance"
              ? `This wallet needs at least the reserved quantity of ${releaseConfig.deliveryToken.symbol} to make the delivery.`
              : "Delivery transaction failed. No qualifying transfer was submitted.",
        );
        return { status: "failed", hash: broadcastHash };
      }
    },
    [
      connection.address,
      connection.chainId,
      creditcoin,
      data.requirements.deliveryWallet,
      data.reservation.id,
      data.reservation.quantity,
      foreign,
      wallet.data,
    ],
  );

  return {
    phase,
    hash,
    message,
    balance,
    checkingBalance,
    refreshBalance,
    send,
    pending: ["awaiting_wallet", "submitted", "confirming"].includes(phase),
  };
}
