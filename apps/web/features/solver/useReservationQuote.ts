"use client";

import { releaseConfig } from "@mozy/chain-config";
import { useQuery } from "@tanstack/react-query";
import { getAddress } from "viem";
import { usePublicClient } from "wagmi";
import { marketAbi, vaultAbi } from "@/lib/acquisition-contracts";
import type {
  Mandate,
  ReservationQuote,
  VaultAccount,
} from "@/features/acquisitions/types";

export class ReservationQuoteChangedError extends Error {}

export async function readFreshReservationQuote(
  client: NonNullable<ReturnType<typeof usePublicClient>>,
  mandateId: bigint,
  quantity: bigint,
) {
  const block = await client.getBlock();
  const quotedAtBlock = block.number;
  const [quote, mandate, account] = await Promise.all([
    client.readContract({
      address: releaseConfig.contracts.market,
      abi: marketAbi,
      functionName: "quoteReservation",
      args: [mandateId, quantity],
      blockNumber: quotedAtBlock,
    }),
    client.readContract({
      address: releaseConfig.contracts.market,
      abi: marketAbi,
      functionName: "getMandate",
      args: [mandateId],
      blockNumber: quotedAtBlock,
    }),
    client.readContract({
      address: releaseConfig.contracts.vault,
      abi: vaultAbi,
      functionName: "getAccount",
      args: [mandateId],
      blockNumber: quotedAtBlock,
    }),
  ]);
  const typedMandate = mandate as Mandate;
  const typedAccount = account as VaultAccount;
  const value = {
    ...quote,
    quotedAtBlock,
    quotedAtTimestamp: block.timestamp,
  } as ReservationQuote;
  const accountingVerified =
    typedAccount.funded === typedMandate.requiredFunding &&
    typedAccount.funded ===
      typedAccount.spent +
        typedAccount.reserved +
        typedAccount.free +
        typedAccount.refunded;
  if (
    value.mandateId !== mandateId ||
    value.quantity !== quantity ||
    value.startPosition !==
      typedMandate.acquiredAmount + typedMandate.reservedAmount ||
    value.endPosition !== value.startPosition + quantity ||
    value.endPosition > typedMandate.targetAmount ||
    value.payout > typedAccount.free ||
    value.eligibility !== 0 ||
    typedMandate.status !== 1 ||
    getAddress(value.foreignToken) !== releaseConfig.deliveryToken.address ||
    getAddress(value.settlementToken) !==
      releaseConfig.settlementToken.address ||
    getAddress(value.deliveryWallet) !==
      getAddress(typedMandate.deliveryWallet) ||
    !accountingVerified
  )
    throw new ReservationQuoteChangedError("Reservation quote changed");
  return value;
}

export function useReservationQuote(
  mandateId: bigint,
  quantity?: bigint,
  enabled = false,
) {
  const client = usePublicClient({ chainId: releaseConfig.creditcoin.id });
  return useQuery({
    queryKey: [
      "reservation-quote",
      releaseConfig.configVersion,
      mandateId.toString(),
      quantity?.toString(),
    ],
    enabled: !!client && enabled && quantity !== undefined,
    retry: false,
    placeholderData: (previous) => previous,
    queryFn: async () => {
      if (!client || quantity === undefined)
        throw new Error("Reservation quote unavailable");
      return readFreshReservationQuote(client, mandateId, quantity);
    },
  });
}
