import { Contract } from "ethers";
import { releaseConfig } from "@mozy/chain-config";
import {
  foreignTransactions,
  buildSettlementReceiptProjection,
  getDatabase,
  heartbeat,
  mandates,
  markets,
  protocolEvents,
  reservations,
  upsertSettlementReceipt,
  type SettlementEventPayload,
} from "@mozy/db";
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { createCreditcoinProvider } from "../../../scripts/attestcoin/providers.js";
import { loadContractArtifact } from "../../../scripts/protocol/artifacts.js";
import type { workerConfig } from "./config.js";

type Config = ReturnType<typeof workerConfig>;

export async function reconcileOnce(config: Config) {
  const db = getDatabase();
  const provider = createCreditcoinProvider(config.CREDITCOIN_RPC_URL);
  const [marketArtifact, vaultArtifact, registryArtifact] = await Promise.all([
    loadContractArtifact("MozyMarket"),
    loadContractArtifact("SettlementVault"),
    loadContractArtifact("MarketRegistry"),
  ]);
  const market = new Contract(
    releaseConfig.contracts.market,
    marketArtifact.abi,
    provider,
  );
  const vault = new Contract(
    releaseConfig.contracts.vault,
    vaultArtifact.abi,
    provider,
  );
  const registry = new Contract(
    releaseConfig.contracts.registry,
    registryArtifact.abi,
    provider,
  );
  const block = BigInt(await provider.getBlockNumber());
  const missingTimes = await db
    .selectDistinct({ blockNumber: protocolEvents.blockNumber })
    .from(protocolEvents)
    .where(
      and(
        eq(protocolEvents.chainId, BigInt(releaseConfig.creditcoin.id)),
        inArray(protocolEvents.contractAddress, [
          releaseConfig.contracts.market.toLowerCase(),
          releaseConfig.contracts.registry.toLowerCase(),
          releaseConfig.contracts.settlement.toLowerCase(),
        ]),
        isNull(protocolEvents.occurredAt),
        isNull(protocolEvents.orphanedAt),
      ),
    )
    .limit(100);
  await Promise.all(
    missingTimes.map(async ({ blockNumber }) => {
      const sourceBlock = await provider.getBlock(blockNumber);
      if (!sourceBlock) return;
      await db
        .update(protocolEvents)
        .set({ occurredAt: new Date(sourceBlock.timestamp * 1000) })
        .where(
          and(
            eq(protocolEvents.chainId, BigInt(releaseConfig.creditcoin.id)),
            eq(protocolEvents.blockNumber, blockNumber),
          ),
        );
    }),
  );
  const configuredMarket = (await registry.getMarket(
    BigInt(releaseConfig.marketId),
  )) as readonly unknown[];
  await db
    .insert(markets)
    .values({
      configVersion: releaseConfig.configVersion,
      marketId: releaseConfig.marketId,
      creditcoinChainId: BigInt(releaseConfig.creditcoin.id),
      sourceChainKey: configuredMarket[0] as bigint,
      foreignChainId: BigInt(releaseConfig.foreign.id),
      foreignToken: String(configuredMarket[1]).toLowerCase(),
      foreignTokenDecimals: Number(configuredMarket[2]),
      settlementToken: String(configuredMarket[3]).toLowerCase(),
      settlementTokenDecimals: Number(configuredMarket[4]),
      enabled: Boolean(configuredMarket[5]),
      lastCanonicalBlock: block,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [markets.configVersion, markets.marketId],
      set: {
        enabled: Boolean(configuredMarket[5]),
        lastCanonicalBlock: block,
        updatedAt: new Date(),
      },
    });
  const [candidateIds, eventIds] = await Promise.all([
    db
      .selectDistinct({ reservationId: foreignTransactions.reservationId })
      .from(foreignTransactions)
      .limit(100),
    db
      .selectDistinct({ reservationId: protocolEvents.reservationId })
      .from(protocolEvents)
      .where(
        and(
          isNull(protocolEvents.orphanedAt),
          isNotNull(protocolEvents.reservationId),
        ),
      )
      .limit(100),
  ]);
  const reservationIds = [
    ...new Set(
      [...candidateIds, ...eventIds]
        .map((item) => item.reservationId)
        .filter((id): id is string => id !== null),
    ),
  ].slice(0, 100);
  for (const reservationId of reservationIds) {
    let reservation: readonly unknown[];
    try {
      reservation = (await market.getReservation(
        BigInt(reservationId),
      )) as readonly unknown[];
    } catch {
      continue;
    }
    await db
      .insert(reservations)
      .values({
        configVersion: releaseConfig.configVersion,
        reservationId,
        mandateId: String(reservation[1]),
        solver: String(reservation[2]).toLowerCase(),
        quantity: String(reservation[3]),
        lockedPayout: String(reservation[4]),
        bondAmount: String(reservation[5]),
        createdAtChain: reservation[6] as bigint,
        deliveryDeadline: reservation[7] as bigint,
        sourceStartHeight: reservation[8] as bigint,
        sourceEndHeight: reservation[9] as bigint,
        expiryEligibleHeight: reservation[10] as bigint,
        status: Number(reservation[11]),
        lastCanonicalBlock: block,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [reservations.configVersion, reservations.reservationId],
        set: {
          mandateId: String(reservation[1]),
          solver: String(reservation[2]).toLowerCase(),
          quantity: String(reservation[3]),
          lockedPayout: String(reservation[4]),
          bondAmount: String(reservation[5]),
          status: Number(reservation[11]),
          lastCanonicalBlock: block,
          updatedAt: new Date(),
        },
      });
    const mandateId = BigInt(String(reservation[1]));
    const [mandate, account] = await Promise.all([
      market.getMandate(mandateId) as Promise<readonly unknown[]>,
      vault.getAccount(mandateId) as Promise<readonly unknown[]>,
    ]);
    await db
      .insert(mandates)
      .values({
        configVersion: releaseConfig.configVersion,
        mandateId: mandateId.toString(),
        marketId: String(mandate[2]),
        buyer: String(mandate[1]).toLowerCase(),
        deliveryWallet: String(mandate[3]).toLowerCase(),
        targetAmount: String(mandate[4]),
        acquiredAmount: String(mandate[5]),
        reservedAmount: String(mandate[6]),
        pricingMode: Number(mandate[7]),
        startPrice: String(mandate[8]),
        endPrice: String(mandate[9]),
        requiredFunding: String(mandate[10]),
        settlementToken: String(account[0]).toLowerCase(),
        funded: String(account[1]),
        spent: String(account[2]),
        reservedBudget: String(account[3]),
        freeBudget: String(account[4]),
        refunded: String(account[5]),
        mandateExpiry: mandate[11] as bigint,
        reservationDuration: mandate[12] as bigint,
        status: Number(mandate[13]),
        createdAtChain: mandate[14] as bigint,
        lastCanonicalBlock: block,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [mandates.configVersion, mandates.mandateId],
        set: {
          acquiredAmount: String(mandate[5]),
          reservedAmount: String(mandate[6]),
          funded: String(account[1]),
          spent: String(account[2]),
          reservedBudget: String(account[3]),
          freeBudget: String(account[4]),
          refunded: String(account[5]),
          status: Number(mandate[13]),
          lastCanonicalBlock: block,
          updatedAt: new Date(),
        },
      });
    if (Number(reservation[11]) === 2) {
      const settlementEvent = await db.query.protocolEvents.findFirst({
        where: and(
          eq(protocolEvents.chainId, BigInt(releaseConfig.creditcoin.id)),
          eq(
            protocolEvents.contractAddress,
            releaseConfig.contracts.settlement.toLowerCase(),
          ),
          eq(protocolEvents.eventName, "ReservationSettled"),
          eq(protocolEvents.reservationId, reservationId),
          isNull(protocolEvents.orphanedAt),
        ),
        orderBy: [desc(protocolEvents.blockNumber), desc(protocolEvents.logIndex)],
      });
      const payload = settlementEvent?.payload as
        | SettlementEventPayload
        | undefined;
      if (settlementEvent && payload) {
        try {
          const candidate = await db.query.foreignTransactions.findFirst({
            where: and(
              eq(
                foreignTransactions.configVersion,
                releaseConfig.configVersion,
              ),
              eq(foreignTransactions.reservationId, reservationId),
              eq(
                foreignTransactions.observedBlockNumber,
                BigInt(payload.blockHeight),
              ),
              eq(
                foreignTransactions.transactionIndex,
                BigInt(payload.transactionIndex),
              ),
              eq(foreignTransactions.semanticStatus, "accepted"),
            ),
          });
          if (candidate)
            await upsertSettlementReceipt(
              db,
              buildSettlementReceiptProjection({
                configVersion: releaseConfig.configVersion,
                event: {
                  transactionHash: settlementEvent.transactionHash,
                  blockNumber: settlementEvent.blockNumber,
                  payload,
                },
                candidate,
              }),
            );
        } catch {
          // Invalid indexed payloads remain unavailable and are retried after re-indexing.
        }
      }
    }
  }
  await heartbeat(db, releaseConfig.configVersion, "reconciler");
  return reservationIds.length;
}
