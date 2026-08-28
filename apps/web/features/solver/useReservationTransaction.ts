"use client";

import { releaseConfig } from "@mozy/chain-config";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { decodeEventLog, getAddress, type Hash } from "viem";
import { useConnection, usePublicClient, useWalletClient } from "wagmi";
import type { TransactionPhase } from "@/components/states/TransactionState";
import {
  erc20Abi,
  marketAbi,
  reservationCreatedEvent,
} from "@/lib/acquisition-contracts";
import { classifyWalletError } from "@/lib/wallet-errors";
import type {
  Reservation,
  ReservationQuote,
} from "@/features/acquisitions/types";
import {
  readFreshReservationQuote,
  ReservationQuoteChangedError,
} from "./useReservationQuote";

export type ReservationAction = "approve" | "reserve";

export function useReservationTransaction(mandateId: bigint) {
  const connection = useConnection();
  const client = usePublicClient({ chainId: releaseConfig.creditcoin.id });
  const wallet = useWalletClient({ chainId: releaseConfig.creditcoin.id });
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<TransactionPhase>("idle");
  const [hash, setHash] = useState<Hash>();
  const [message, setMessage] = useState<string>();
  const [action, setAction] = useState<ReservationAction>();
  const [uncertain, setUncertain] = useState(false);

  const run = useCallback(
    async (nextAction: ReservationAction, displayedQuote: ReservationQuote) => {
      if (
        !client ||
        !wallet.data ||
        !connection.address ||
        connection.chainId !== releaseConfig.creditcoin.id
      )
        return undefined;
      let broadcastHash: Hash | undefined;
      let receiptKnown = false;
      let reservationReceiptSucceeded = false;
      setAction(nextAction);
      setPhase("awaiting_wallet");
      setHash(undefined);
      setMessage(undefined);
      setUncertain(false);
      try {
        const solver = getAddress(connection.address);
        const freshQuote = await readFreshReservationQuote(
          client,
          mandateId,
          displayedQuote.quantity,
        );
        if (
          freshQuote.payout !== displayedQuote.payout ||
          freshQuote.startPosition !== displayedQuote.startPosition
        )
          throw new ReservationQuoteChangedError();
        const [allowance, balance] = await Promise.all([
          client.readContract({
            address: releaseConfig.settlementToken.address,
            abi: erc20Abi,
            functionName: "allowance",
            args: [solver, releaseConfig.contracts.vault],
          }),
          client.readContract({
            address: releaseConfig.settlementToken.address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [solver],
          }),
        ]);
        if (balance < freshQuote.bondAmount)
          throw new Error("Insufficient bond balance");
        let transactionHash: Hash;
        if (nextAction === "approve") {
          if (allowance >= freshQuote.bondAmount)
            throw new Error("Approval already sufficient");
          const simulation = await client.simulateContract({
            account: solver,
            address: releaseConfig.settlementToken.address,
            abi: erc20Abi,
            functionName: "approve",
            args: [releaseConfig.contracts.vault, freshQuote.bondAmount],
          });
          transactionHash = await wallet.data.writeContract(simulation.request);
        } else {
          if (allowance < freshQuote.bondAmount)
            throw new Error("Bond approval required");
          const simulation = await client.simulateContract({
            account: solver,
            address: releaseConfig.contracts.market,
            abi: marketAbi,
            functionName: "createReservation",
            args: [mandateId, freshQuote.quantity, freshQuote.payout],
          });
          transactionHash = await wallet.data.writeContract(simulation.request);
        }
        broadcastHash = transactionHash;
        setHash(transactionHash);
        setPhase("submitted");
        setPhase("confirming");
        const receipt = await client.waitForTransactionReceipt({
          hash: transactionHash,
        });
        receiptKnown = true;
        if (receipt.status !== "success")
          throw new Error("Transaction reverted");
        if (nextAction === "approve") {
          const refreshedAllowance = await client.readContract({
            address: releaseConfig.settlementToken.address,
            abi: erc20Abi,
            functionName: "allowance",
            args: [solver, releaseConfig.contracts.vault],
          });
          if (refreshedAllowance < freshQuote.bondAmount)
            throw new Error("Approval readback failed");
          setPhase("canonical_confirmed");
          setMessage("Bond approval confirmed. You can now reserve this fill.");
          await queryClient.invalidateQueries({
            queryKey: ["bond-readiness", releaseConfig.configVersion],
          });
          return undefined;
        }
        reservationReceiptSucceeded = true;
        let reservationId: bigint | undefined;
        for (const log of receipt.logs) {
          if (getAddress(log.address) !== releaseConfig.contracts.market)
            continue;
          try {
            const decoded = decodeEventLog({
              abi: [reservationCreatedEvent],
              data: log.data,
              topics: log.topics,
            });
            const args = decoded.args;
            if (
              args.mandateId === mandateId &&
              getAddress(args.solver) === solver &&
              args.quantity === freshQuote.quantity &&
              args.lockedPayout === freshQuote.payout &&
              args.bondAmount === freshQuote.bondAmount
            )
              reservationId = args.reservationId;
          } catch {
            /* A receipt may contain unrelated logs. */
          }
        }
        if (reservationId === undefined)
          throw new Error("Reservation event unavailable");
        const reservation = (await client.readContract({
          address: releaseConfig.contracts.market,
          abi: marketAbi,
          functionName: "getReservation",
          args: [reservationId],
        })) as Reservation;
        if (
          reservation.status !== 0 ||
          reservation.mandateId !== mandateId ||
          getAddress(reservation.solver) !== solver ||
          reservation.quantity !== freshQuote.quantity ||
          reservation.lockedPayout !== freshQuote.payout ||
          reservation.bondAmount !== freshQuote.bondAmount
        )
          throw new Error("Reservation readback failed");
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ["open-markets", releaseConfig.configVersion],
          }),
          queryClient.invalidateQueries({
            queryKey: ["acquisition-snapshot", releaseConfig.configVersion],
          }),
          queryClient.invalidateQueries({
            queryKey: ["solver-reservations", releaseConfig.configVersion],
          }),
        ]);
        setPhase("canonical_confirmed");
        setMessage("Fill reserved. Your payout and delivery terms are locked.");
        return reservationId;
      } catch (error) {
        const isUncertain =
          !!broadcastHash && (!receiptKnown || reservationReceiptSucceeded);
        setUncertain(isUncertain);
        setPhase(isUncertain ? "submitted" : "rejected");
        const rejected = classifyWalletError(error) === "user_rejected";
        setMessage(
          isUncertain
            ? reservationReceiptSucceeded
              ? "The reservation transaction confirmed, but its canonical R-reference is still being recovered. Check this transaction before trying again."
              : "Transaction status is uncertain. Check it before trying again."
            : error instanceof ReservationQuoteChangedError
              ? "This acquisition changed. Review the latest open amount and payout."
              : rejected
                ? "Transaction cancelled. Nothing was submitted."
                : nextAction === "approve"
                  ? "Bond approval didn’t complete. Review your BTKT balance and allowance."
                  : "This fill couldn’t be reserved. Review the latest availability and try again.",
        );
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ["reservation-quote", releaseConfig.configVersion],
          }),
          queryClient.invalidateQueries({
            queryKey: ["bond-readiness", releaseConfig.configVersion],
          }),
          queryClient.invalidateQueries({
            queryKey: ["acquisition-snapshot", releaseConfig.configVersion],
          }),
        ]);
        return undefined;
      }
    },
    [
      client,
      connection.address,
      connection.chainId,
      mandateId,
      queryClient,
      wallet.data,
    ],
  );

  return {
    action,
    phase,
    hash,
    message,
    uncertain,
    pending:
      ["awaiting_wallet", "submitted", "confirming"].includes(phase) ||
      uncertain,
    run,
  };
}
