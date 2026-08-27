"use client";

import { useQueryClient } from "@tanstack/react-query";
import { releaseConfig } from "@mozy/chain-config";
import { useCallback, useState } from "react";
import type { Hash } from "viem";
import { useConnection, usePublicClient, useWalletClient } from "wagmi";
import { erc20Abi, marketAbi, vaultAbi } from "@/lib/acquisition-contracts";
import { classifyWalletError } from "@/lib/wallet-errors";
import type { TransactionPhase } from "@/components/states/TransactionState";

export type AcquisitionAction = "approve" | "fund" | "pause" | "resume" | "cancel" | "expire" | "refund" | "close";

export function useAcquisitionTransactions(mandateId: bigint) {
  const connection = useConnection();
  const client = usePublicClient({ chainId: releaseConfig.creditcoin.id });
  const wallet = useWalletClient({ chainId: releaseConfig.creditcoin.id });
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<TransactionPhase>("idle");
  const [hash, setHash] = useState<Hash>();
  const [message, setMessage] = useState<string>();
  const [action, setAction] = useState<AcquisitionAction>();
  const [uncertain, setUncertain] = useState(false);

  const run = useCallback(async (nextAction: AcquisitionAction, amount?: bigint) => {
    if (!client || !wallet.data || !connection.address || connection.chainId !== releaseConfig.creditcoin.id) return;
    let broadcastHash: Hash | undefined;
    let receiptKnown = false;
    setAction(nextAction); setMessage(undefined); setHash(undefined); setUncertain(false); setPhase("awaiting_wallet");
    try {
      const [freshMandate, freshAccount] = await Promise.all([
        client.readContract({ address: releaseConfig.contracts.market, abi: marketAbi, functionName: "getMandate", args: [mandateId] }),
        client.readContract({ address: releaseConfig.contracts.vault, abi: vaultAbi, functionName: "getAccount", args: [mandateId] }),
      ]);
      const actionAmount = nextAction === "approve" || nextAction === "fund"
        ? freshMandate.requiredFunding - freshAccount.funded
        : nextAction === "refund" ? freshAccount.free : amount;
      let txHash: Hash;
      if (nextAction === "approve") {
        if (actionAmount === undefined || actionAmount === 0n) throw new Error("Approval amount unavailable");
        const simulation = await client.simulateContract({ account: connection.address, address: releaseConfig.settlementToken.address, abi: erc20Abi, functionName: "approve", args: [releaseConfig.contracts.vault, actionAmount] });
        txHash = await wallet.data.writeContract(simulation.request);
      } else if (nextAction === "fund") {
        if (actionAmount === undefined || actionAmount === 0n) throw new Error("Funding amount unavailable");
        const simulation = await client.simulateContract({ account: connection.address, address: releaseConfig.contracts.market, abi: marketAbi, functionName: "fundMandate", args: [mandateId, actionAmount] });
        txHash = await wallet.data.writeContract(simulation.request);
      } else if (nextAction === "refund") {
        if (actionAmount === undefined || actionAmount === 0n) throw new Error("Refund amount unavailable");
        const simulation = await client.simulateContract({ account: connection.address, address: releaseConfig.contracts.market, abi: marketAbi, functionName: "refundMandate", args: [mandateId, actionAmount] });
        txHash = await wallet.data.writeContract(simulation.request);
      } else if (nextAction === "pause") {
        const simulation = await client.simulateContract({ account: connection.address, address: releaseConfig.contracts.market, abi: marketAbi, functionName: "pauseMandate", args: [mandateId] });
        txHash = await wallet.data.writeContract(simulation.request);
      } else if (nextAction === "resume") {
        const simulation = await client.simulateContract({ account: connection.address, address: releaseConfig.contracts.market, abi: marketAbi, functionName: "resumeMandate", args: [mandateId] });
        txHash = await wallet.data.writeContract(simulation.request);
      } else if (nextAction === "cancel") {
        const simulation = await client.simulateContract({ account: connection.address, address: releaseConfig.contracts.market, abi: marketAbi, functionName: "cancelMandate", args: [mandateId] });
        txHash = await wallet.data.writeContract(simulation.request);
      } else if (nextAction === "expire") {
        const simulation = await client.simulateContract({ account: connection.address, address: releaseConfig.contracts.market, abi: marketAbi, functionName: "expireMandate", args: [mandateId] });
        txHash = await wallet.data.writeContract(simulation.request);
      } else {
        const simulation = await client.simulateContract({ account: connection.address, address: releaseConfig.contracts.market, abi: marketAbi, functionName: "closeMandate", args: [mandateId] });
        txHash = await wallet.data.writeContract(simulation.request);
      }
      broadcastHash = txHash;
      setHash(txHash); setPhase("submitted");
      setPhase("confirming");
      const receipt = await client.waitForTransactionReceipt({ hash: txHash });
      receiptKnown = true;
      if (receipt.status !== "success") throw new Error("Transaction reverted");
      if (nextAction === "approve") {
        const allowance = await client.readContract({ address: releaseConfig.settlementToken.address, abi: erc20Abi, functionName: "allowance", args: [connection.address, releaseConfig.contracts.vault] });
        if (actionAmount === undefined || allowance < actionAmount) throw new Error("Approval readback did not reconcile");
      } else {
        const [mandate, account] = await Promise.all([
          client.readContract({ address: releaseConfig.contracts.market, abi: marketAbi, functionName: "getMandate", args: [mandateId] }),
          client.readContract({ address: releaseConfig.contracts.vault, abi: vaultAbi, functionName: "getAccount", args: [mandateId] }),
        ]);
        const expectedStatus: Partial<Record<AcquisitionAction, number>> = { fund: 1, pause: 2, resume: 1, cancel: 3, expire: 4, close: 6 };
        if (expectedStatus[nextAction] !== undefined && mandate.status !== expectedStatus[nextAction]) throw new Error("Canonical state did not reconcile");
        if (nextAction === "fund" && (account.funded !== mandate.requiredFunding || account.free !== mandate.requiredFunding)) throw new Error("Funding readback did not reconcile");
        if (nextAction === "refund" && account.free !== 0n) throw new Error("Refund readback did not reconcile");
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["acquisition", releaseConfig.configVersion] }),
        queryClient.invalidateQueries({ queryKey: ["owned-acquisitions", releaseConfig.configVersion] }),
        queryClient.invalidateQueries({ queryKey: ["funding-readiness", releaseConfig.configVersion] }),
        queryClient.invalidateQueries({ queryKey: ["release-market", releaseConfig.configVersion] }),
      ]);
      setPhase("canonical_confirmed");
      const successes: Record<AcquisitionAction, string> = { approve: "Approval confirmed", fund: "Acquisition open", pause: "Acquisition paused", resume: "Acquisition resumed", cancel: "Open remainder cancelled", expire: "Acquisition marked expired", refund: "Funds reclaimed", close: "Acquisition closed" };
      setMessage(successes[nextAction]);
    } catch (error) {
      setPhase("rejected");
      const rejected = classifyWalletError(error) === "user_rejected";
      const statusUncertain = !!broadcastHash && !receiptKnown;
      setUncertain(statusUncertain);
      setMessage(statusUncertain ? "Transaction status is uncertain. Check the transaction before trying again." : nextAction === "approve" && rejected ? "Approval cancelled. No BTKT was moved." : rejected ? "Transaction cancelled. Nothing was submitted." : nextAction === "fund" ? "Funding did not complete. Your acquisition remains in its latest confirmed state." : "The acquisition changed before this action completed. Review the latest state and try again.");
      await queryClient.invalidateQueries({ queryKey: ["acquisition", releaseConfig.configVersion] });
    }
  }, [client, connection.address, connection.chainId, mandateId, queryClient, wallet.data]);

  return { action, phase, hash, message, pending: phase === "awaiting_wallet" || phase === "submitted" || phase === "confirming" || uncertain, run };
}
