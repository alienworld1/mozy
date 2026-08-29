"use client";

import { releaseConfig } from "@mozy/chain-config";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getAddress, isAddress } from "viem";
import { useConnection, usePublicClient, useSignMessage } from "wagmi";
import { faucetErc20Abi } from "@/lib/acquisition-contracts";
import { classifyWalletError } from "@/lib/wallet-errors";
import { buildTestFundsClaimStatement } from "./claim";
import type {
  TestFundsBalances,
  TestFundsResponse,
  UnsignedTestFundsClaim,
} from "./types";

export function useTestFunds() {
  const connection = useConnection();
  const address = connection.address && isAddress(connection.address)
    ? getAddress(connection.address)
    : undefined;
  const sepolia = usePublicClient({ chainId: releaseConfig.foreign.id });
  const creditcoin = usePublicClient({ chainId: releaseConfig.creditcoin.id });
  const { signMessageAsync } = useSignMessage();
  const queryClient = useQueryClient();
  const [claim, setClaim] = useState<TestFundsResponse>();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const shouldPoll = claim?.status === "submitted" || claim?.assets.test.status === "uncertain" || claim?.assets.btkt.status === "uncertain";

  const balances = useQuery({
    queryKey: ["test-funds-balances", releaseConfig.configVersion, address],
    enabled: !!address && !!sepolia && !!creditcoin,
    refetchInterval: (query) => {
      const current = query.state.data;
      const tokensReady = current
        ? current.test >= releaseConfig.testnetFunding.deliveryTokenTarget && current.btkt >= releaseConfig.testnetFunding.settlementTokenTarget
        : false;
      return shouldPoll && !tokensReady ? 5_000 : false;
    },
    queryFn: async (): Promise<TestFundsBalances> => {
      if (!address || !sepolia || !creditcoin) throw new Error("Test-funds balances unavailable");
      const [sepoliaGas, test, creditcoinGas, btkt] = await Promise.all([
        sepolia.getBalance({ address }),
        sepolia.readContract({ address: releaseConfig.deliveryToken.address, abi: faucetErc20Abi, functionName: "balanceOf", args: [address] }),
        creditcoin.getBalance({ address }),
        creditcoin.readContract({ address: releaseConfig.settlementToken.address, abi: faucetErc20Abi, functionName: "balanceOf", args: [address] }),
      ]);
      return { sepoliaGas, test, creditcoinGas, btkt };
    },
  });

  const request = useCallback(async () => {
    if (!address || pending) return;
    setPending(true);
    setMessage(undefined);
    try {
      const issuedAt = new Date();
      const unsigned: UnsignedTestFundsClaim = {
        address,
        origin: window.location.origin,
        issuedAt: issuedAt.toISOString(),
        expiresAt: new Date(issuedAt.getTime() + 5 * 60 * 1_000).toISOString(),
        configVersion: releaseConfig.configVersion,
      };
      const signature = await signMessageAsync({ message: buildTestFundsClaimStatement(unsigned) });
      const response = await fetch("/api/test-funds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...unsigned, signature }),
      });
      const json = (await response.json()) as Partial<TestFundsResponse> & { message?: string };
      if (!json.assets || !json.status || !json.address) {
        throw new Error(json.message ?? "Mozy couldn’t prepare the testnet funds.");
      }
      const nextClaim = json as TestFundsResponse;
      setClaim(nextClaim);
      setMessage(nextClaim.message);
      await queryClient.invalidateQueries({ queryKey: ["test-funds-balances", releaseConfig.configVersion, address] });
    } catch (error) {
      const rejected = classifyWalletError(error) === "user_rejected";
      setMessage(rejected
        ? "Signature cancelled. Nothing was submitted."
        : error instanceof Error
          ? error.message
          : "Mozy couldn’t prepare the testnet funds. Nothing was sent from your wallet.");
    } finally {
      setPending(false);
    }
  }, [address, pending, queryClient, signMessageAsync]);

  return { address, balances, claim, pending, message, request };
}
