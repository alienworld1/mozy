import "server-only";

import { releaseConfig } from "@mozy/chain-config";
import {
  foreignTransactions,
  getDatabase,
  proofJobs,
  protocolEvents,
  settlementReceipts,
  upsertSettlementReceipt,
  buildSettlementReceiptProjection,
} from "@mozy/db";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  getAddress,
  http,
  isAddress,
  isHash,
} from "viem";
import { z } from "zod";
import type { ReceiptResponse } from "@/features/receipts/types";
import { marketAbi, settlementAbi } from "@/lib/acquisition-contracts";
import { isStandardTransferEvidence } from "@/features/receipts/validation";

const settlementPayloadSchema = z.object({
  reservationId: z.string().regex(/^\d+$/),
  mandateId: z.string().regex(/^\d+$/),
  replayIdentity: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  sourceChainKey: z.string().regex(/^\d+$/),
  blockHeight: z.string().regex(/^\d+$/),
  transactionIndex: z.string().regex(/^\d+$/),
  transferLogIndex: z.string().regex(/^\d+$/),
  token: z.string(),
  solver: z.string(),
  recipient: z.string(),
  relayer: z.string(),
  deliveredAmount: z.string().regex(/^\d+$/),
  creditedAmount: z.string().regex(/^\d+$/),
  lockedPayout: z.string().regex(/^\d+$/),
  returnedBond: z.string().regex(/^\d+$/),
});

const client = createPublicClient({
  chain: releaseConfig.creditcoin,
  transport: http(releaseConfig.creditcoin.rpcUrls.default.http[0]),
});

async function loadProjection(reservationId: string) {
  return getDatabase().query.settlementReceipts.findFirst({
    where: and(
      eq(settlementReceipts.configVersion, releaseConfig.configVersion),
      eq(settlementReceipts.reservationId, reservationId),
    ),
  });
}

async function rebuildProjection(reservationId: string) {
  const db = getDatabase();
  const event = await db.query.protocolEvents.findFirst({
    where: and(
      eq(protocolEvents.chainId, BigInt(releaseConfig.creditcoin.id)),
      eq(protocolEvents.contractAddress, releaseConfig.contracts.settlement.toLowerCase()),
      eq(protocolEvents.eventName, "ReservationSettled"),
      eq(protocolEvents.reservationId, reservationId),
      isNull(protocolEvents.orphanedAt),
    ),
    orderBy: [desc(protocolEvents.blockNumber), desc(protocolEvents.logIndex)],
  });
  if (!event || !event.occurredAt) return undefined;
  const parsed = settlementPayloadSchema.safeParse(event.payload);
  if (!parsed.success) return undefined;
  const payload = parsed.data;
  const candidate = await db.query.foreignTransactions.findFirst({
    where: and(
      eq(foreignTransactions.configVersion, releaseConfig.configVersion),
      eq(foreignTransactions.reservationId, reservationId),
      eq(foreignTransactions.observedBlockNumber, BigInt(payload.blockHeight)),
      eq(foreignTransactions.transactionIndex, BigInt(payload.transactionIndex)),
      eq(foreignTransactions.transferLogIndex, BigInt(payload.transferLogIndex)),
      eq(foreignTransactions.receiptStatus, 1),
      eq(foreignTransactions.transactionTo, payload.token.toLowerCase()),
      eq(foreignTransactions.transferFrom, payload.solver.toLowerCase()),
      eq(foreignTransactions.transferTo, payload.recipient.toLowerCase()),
      eq(foreignTransactions.transferAmount, payload.deliveredAmount),
      eq(foreignTransactions.semanticStatus, "accepted"),
    ),
    orderBy: [desc(foreignTransactions.observedAt)],
  });
  if (!candidate) return undefined;
  await upsertSettlementReceipt(
    db,
    buildSettlementReceiptProjection({
      configVersion: releaseConfig.configVersion,
      event: {
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        payload,
      },
      candidate,
    }),
  );
  return loadProjection(reservationId);
}

function sameAddress(left: string, right: string) {
  return isAddress(left) && isAddress(right) && getAddress(left) === getAddress(right);
}

function safeExplorer(base: string, hash: string) {
  return `${base.replace(/\/$/, "")}/tx/${hash}`;
}

function isContractRevert(error: unknown) {
  if (error instanceof ContractFunctionRevertedError) return true;
  return (
    error instanceof BaseError &&
    !!error.walk((cause) => cause instanceof ContractFunctionRevertedError)
  );
}

export async function getDeliveryReceipt(
  reservationId: string,
): Promise<ReceiptResponse> {
  const canonicalPromise = client.readContract({
    address: releaseConfig.contracts.market,
    abi: marketAbi,
    functionName: "getReservation",
    args: [BigInt(reservationId)],
  });
  let projection = await loadProjection(reservationId);
  let canonical;
  try {
    canonical = await canonicalPromise;
  } catch (error) {
    if (!projection && isContractRevert(error))
      return { status: "not_found", message: "We couldn't find that delivery receipt." };
    throw new Error("canonical_reservation_unavailable");
  }
  if (canonical.status !== 2)
    return {
      status: "pending",
      message: "A completed receipt is available after Creditcoin confirms settlement.",
    };
  if (!projection) projection = await rebuildProjection(reservationId);
  if (!projection)
    return {
      status: "rebuilding",
      message: "We're rebuilding this receipt from confirmed settlement data.",
    };

  const db = getDatabase();
  const [candidate, settlementEventRows, job, requirements, mandate] = await Promise.all([
    db.query.foreignTransactions.findFirst({
      where: eq(foreignTransactions.id, projection.foreignTransactionId),
    }),
    db
      .select()
      .from(protocolEvents)
      .where(and(
        eq(protocolEvents.chainId, BigInt(releaseConfig.creditcoin.id)),
        eq(protocolEvents.contractAddress, releaseConfig.contracts.settlement.toLowerCase()),
        eq(protocolEvents.eventName, "ReservationSettled"),
        eq(protocolEvents.reservationId, reservationId),
        isNull(protocolEvents.orphanedAt),
      ))
      .limit(2),
    db.query.proofJobs.findFirst({
      where: eq(proofJobs.foreignTransactionId, projection.foreignTransactionId),
    }),
    client.readContract({
      address: releaseConfig.contracts.market,
      abi: marketAbi,
      functionName: "getReservationRequirements",
      args: [BigInt(reservationId)],
    }),
    client.readContract({
      address: releaseConfig.contracts.market,
      abi: marketAbi,
      functionName: "getMandate",
      args: [canonical.mandateId],
    }),
  ]);
  const event = settlementEventRows.length === 1 ? settlementEventRows[0] : undefined;
  if (!candidate || !event || !event.occurredAt)
    return { status: "rebuilding", message: "We're rebuilding this receipt from confirmed settlement data." };
  const payloadResult = settlementPayloadSchema.safeParse(event.payload);
  if (!payloadResult.success)
    return { status: "inconsistent", message: "Confirmed receipt evidence is being reconciled." };
  const payload = payloadResult.data;
  const replayReservation = await client.readContract({
    address: releaseConfig.contracts.settlement,
    abi: settlementAbi,
    functionName: "receiptReservation",
    args: [projection.replayIdentity as `0x${string}`],
  });
  const observedAmount = BigInt(projection.deliveredAmount);
  const creditedAmount = BigInt(projection.creditedAmount);
  const hashesValid = isHash(projection.foreignTxHash) && isHash(projection.creditcoinSettlementTxHash);
  const eventMatches =
    event.transactionHash === projection.creditcoinSettlementTxHash &&
    payload.reservationId === reservationId &&
    payload.mandateId === projection.mandateId &&
    payload.replayIdentity.toLowerCase() === projection.replayIdentity &&
    payload.sourceChainKey === projection.sourceChainKey.toString() &&
    payload.blockHeight === projection.blockHeight.toString() &&
    payload.transactionIndex === projection.transactionIndex.toString() &&
    payload.transferLogIndex === projection.transferLogIndex.toString() &&
    payload.deliveredAmount === projection.deliveredAmount &&
    payload.creditedAmount === projection.creditedAmount &&
    payload.lockedPayout === projection.lockedPayout &&
    payload.returnedBond === projection.returnedBond &&
    sameAddress(payload.token, projection.token) &&
    sameAddress(payload.solver, projection.solver) &&
    sameAddress(payload.recipient, projection.recipient) &&
    sameAddress(payload.relayer, projection.relayer);
  const canonicalMatches =
    canonical.id === BigInt(reservationId) &&
    canonical.mandateId.toString() === projection.mandateId &&
    canonical.quantity.toString() === projection.creditedAmount &&
    canonical.lockedPayout.toString() === projection.lockedPayout &&
    canonical.bondAmount.toString() === projection.returnedBond &&
    sameAddress(canonical.solver, projection.solver) &&
    mandate.id === canonical.mandateId &&
    sameAddress(requirements[1], projection.recipient) &&
    sameAddress(requirements[0].foreignToken, projection.token) &&
    sameAddress(requirements[2], releaseConfig.settlementToken.address) &&
    requirements[0].sourceChainKey.toString() === projection.sourceChainKey.toString() &&
    replayReservation === BigInt(reservationId);
  const candidateMatches =
    candidate.configVersion === releaseConfig.configVersion &&
    candidate.reservationId === reservationId &&
    candidate.foreignChainId === BigInt(releaseConfig.foreign.id) &&
    candidate.sourceChainKey === projection.sourceChainKey &&
    candidate.transactionHash === projection.foreignTxHash &&
    candidate.semanticStatus === "accepted" &&
    candidate.receiptStatus === 1 &&
    (candidate.transactionTo === null || isAddress(candidate.transactionTo)) &&
    candidate.observedBlockNumber === projection.blockHeight &&
    candidate.transactionIndex === projection.transactionIndex;
  if (!hashesValid || !eventMatches || !canonicalMatches || !candidateMatches || observedAmount < creditedAmount)
    return { status: "inconsistent", message: "Confirmed receipt evidence is being reconciled." };

  const standardTransferVerified = isStandardTransferEvidence({
    receiptStatus: candidate.receiptStatus,
    semanticStatus: candidate.semanticStatus,
    transactionTo: candidate.transactionTo,
    transferFrom: candidate.transferFrom,
    transferTo: candidate.transferTo,
    transferAmount: candidate.transferAmount,
    transferLogIndex: candidate.transferLogIndex,
    observedBlockNumber: candidate.observedBlockNumber,
    transactionIndex: candidate.transactionIndex,
    token: projection.token,
    solver: projection.solver,
    recipient: projection.recipient,
    deliveredAmount: projection.deliveredAmount,
    expectedTransferLogIndex: projection.transferLogIndex,
    blockHeight: projection.blockHeight,
    expectedTransactionIndex: projection.transactionIndex,
  });
  const directDeliveryVerified =
    standardTransferVerified &&
    !releaseConfig.foreign.mozyContracts.some((address) =>
      sameAddress(address, candidate.transactionTo ?? ""),
    );
  return {
    status: "complete",
    receipt: {
      mandateId: projection.mandateId,
      reservationId,
      settledAt: event.occurredAt.toISOString(),
      foreign: {
        chainId: releaseConfig.foreign.id.toString(),
        chainName: releaseConfig.foreign.name,
        sourceChainKey: projection.sourceChainKey.toString(),
        tokenAddress: getAddress(projection.token),
        tokenSymbol: releaseConfig.deliveryToken.symbol,
        tokenDecimals: releaseConfig.deliveryToken.decimals,
        sender: getAddress(projection.solver),
        recipient: getAddress(projection.recipient),
        observedAmount: projection.deliveredAmount,
        creditedAmount: projection.creditedAmount,
        transactionHash: projection.foreignTxHash,
        transactionTo: candidate.transactionTo ? getAddress(candidate.transactionTo) : null,
        receiptStatus: "successful",
        transferLogIndex: projection.transferLogIndex.toString(),
        blockHeight: projection.blockHeight.toString(),
        transactionIndex: projection.transactionIndex.toString(),
        standardTransferVerified,
        directDeliveryVerified,
        explorerUrl: safeExplorer(releaseConfig.foreign.blockExplorers.default.url, projection.foreignTxHash),
      },
      verification: {
        protocol: "Attestcoin",
        version: job?.proofVersion ?? null,
        status: "verified",
        replayIdentity: projection.replayIdentity,
        replayStatus: "consumed",
      },
      creditcoin: {
        chainId: releaseConfig.creditcoin.id.toString(),
        chainName: releaseConfig.creditcoin.name,
        transactionHash: projection.creditcoinSettlementTxHash,
        payoutAmount: projection.lockedPayout,
        payoutTokenAddress: releaseConfig.settlementToken.address,
        payoutTokenSymbol: releaseConfig.settlementToken.symbol,
        payoutTokenDecimals: releaseConfig.settlementToken.decimals,
        payoutRecipient: getAddress(projection.solver),
        returnedBond: projection.returnedBond,
        relayer: getAddress(projection.relayer),
        explorerUrl: safeExplorer(releaseConfig.creditcoin.blockExplorers.default.url, projection.creditcoinSettlementTxHash),
      },
    },
  };
}

export async function getReceiptAvailability(reservationIds: string[]) {
  if (!reservationIds.length) return new Set<string>();
  const rows = await getDatabase()
    .select({ reservationId: settlementReceipts.reservationId })
    .from(settlementReceipts)
    .innerJoin(
      protocolEvents,
      and(
        eq(protocolEvents.chainId, BigInt(releaseConfig.creditcoin.id)),
        eq(protocolEvents.contractAddress, releaseConfig.contracts.settlement.toLowerCase()),
        eq(protocolEvents.eventName, "ReservationSettled"),
        eq(protocolEvents.reservationId, settlementReceipts.reservationId),
        eq(protocolEvents.transactionHash, settlementReceipts.creditcoinSettlementTxHash),
        isNull(protocolEvents.orphanedAt),
      ),
    )
    .where(
      and(
        eq(settlementReceipts.configVersion, releaseConfig.configVersion),
        inArray(settlementReceipts.reservationId, reservationIds),
      ),
    )
    .limit(128);
  return new Set(rows.map((row) => row.reservationId));
}
