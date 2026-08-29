import { Contract, Interface, JsonRpcProvider, type Log } from "ethers";
import { releaseConfig } from "@mozy/chain-config";
import {
  foreignTransactions,
  getDatabase,
  mandates,
  markets,
  protocolEvents,
  reservations,
  settlementReceipts,
  syncCursors,
} from "@mozy/db";
import { and, eq, gte, isNull } from "drizzle-orm";
import { createCreditcoinProvider } from "../../../scripts/attestcoin/providers.js";
import { loadContractArtifact } from "../../../scripts/protocol/artifacts.js";
import type { workerConfig } from "./config.js";

type Config = ReturnType<typeof workerConfig>;
const confirmations = BigInt(process.env.MOZY_INDEXER_CONFIRMATIONS ?? "2");
const chunkSize = BigInt(process.env.MOZY_INDEXER_CHUNK_SIZE ?? "1000");

export async function indexOnce(config: Config) {
  const db = getDatabase();
  const provider = createCreditcoinProvider(config.CREDITCOIN_RPC_URL);
  const [artifacts, vaultArtifact] = await Promise.all([
    Promise.all(
      ["MozyMarket", "MarketRegistry", "MozySettlement"].map(
        loadContractArtifact,
      ),
    ),
    loadContractArtifact("SettlementVault"),
  ]);
  const addresses = [
    releaseConfig.contracts.market,
    releaseConfig.contracts.registry,
    releaseConfig.contracts.settlement,
  ];
  const cursor = await db.query.syncCursors.findFirst({
    where: and(
      eq(syncCursors.configVersion, releaseConfig.configVersion),
      eq(syncCursors.streamKey, "indexer"),
    ),
  });
  let nextBlock = cursor?.nextBlock ?? releaseConfig.deploymentBlock;
  if (cursor?.lastSafeBlock && cursor.lastSafeBlockHash) {
    const storedBlock = await provider.getBlock(cursor.lastSafeBlock);
    if (
      !storedBlock ||
      storedBlock.hash?.toLowerCase() !== cursor.lastSafeBlockHash
    ) {
      nextBlock =
        cursor.lastSafeBlock > confirmations
          ? cursor.lastSafeBlock - confirmations
          : releaseConfig.deploymentBlock;
      await db
        .update(protocolEvents)
        .set({ orphanedAt: new Date() })
        .where(
          and(
            eq(protocolEvents.chainId, BigInt(releaseConfig.creditcoin.id)),
            gte(protocolEvents.blockNumber, nextBlock),
            isNull(protocolEvents.orphanedAt),
          ),
        );
      await db
        .delete(settlementReceipts)
        .where(gte(settlementReceipts.settlementBlockNumber, nextBlock));
    }
  }
  const head = BigInt(await provider.getBlockNumber());
  const safeHead = head > confirmations ? head - confirmations : 0n;
  if (nextBlock > safeHead) {
    await updateCursor(
      db,
      nextBlock,
      cursor?.lastSafeBlock,
      cursor?.lastSafeBlockHash,
    );
    return 0;
  }
  const toBlock =
    nextBlock + chunkSize - 1n > safeHead
      ? safeHead
      : nextBlock + chunkSize - 1n;
  const batches = await Promise.all(
    addresses.map(async (address, index) => ({
      address,
      iface: new Interface(artifacts[index].abi),
      logs: await fetchLogsAdaptive(provider, address, nextBlock, toBlock),
    })),
  );
  const safeBlock = await provider.getBlock(toBlock);
  const decoded = batches.flatMap((batch) =>
    batch.logs.flatMap((log) => {
      try {
        const parsed = batch.iface.parseLog(log);
        if (!parsed || !log.blockHash || !log.transactionHash) return [];
        const payload = Object.fromEntries(
          parsed.fragment.inputs.map((input, index) => [
            input.name || String(index),
            jsonValue(parsed.args[index]),
          ]),
        );
        return [{ address: batch.address, log, name: parsed.name, payload }];
      } catch {
        return [];
      }
    }),
  );
  const reservationIds = new Set(
    decoded.flatMap((event) =>
      event.payload.reservationId ? [String(event.payload.reservationId)] : [],
    ),
  );
  const mandateIds = new Set(
    decoded.flatMap((event) =>
      event.payload.mandateId ? [String(event.payload.mandateId)] : [],
    ),
  );
  const market = new Contract(
    releaseConfig.contracts.market,
    artifacts[0].abi,
    provider,
  );
  const vault = new Contract(
    releaseConfig.contracts.vault,
    vaultArtifact.abi,
    provider,
  );
  const registry = new Contract(
    releaseConfig.contracts.registry,
    artifacts[1].abi,
    provider,
  );
  const reservationRows = await Promise.all(
    [...reservationIds].map(async (reservationId) => {
      const reservation = (await market.getReservation(
        BigInt(reservationId),
      )) as readonly unknown[];
      mandateIds.add(String(reservation[1]));
      return {
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
        lastCanonicalBlock: safeHead,
        updatedAt: new Date(),
      };
    }),
  );
  const mandateRows = await Promise.all(
    [...mandateIds].map(async (mandateId) => {
      const [mandate, account] = await Promise.all([
        market.getMandate(BigInt(mandateId)) as Promise<readonly unknown[]>,
        vault.getAccount(BigInt(mandateId)) as Promise<readonly unknown[]>,
      ]);
      return {
        configVersion: releaseConfig.configVersion,
        mandateId,
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
        lastCanonicalBlock: safeHead,
        updatedAt: new Date(),
      };
    }),
  );
  const marketRow = decoded.some(
    (event) =>
      event.name === "MarketConfigured" || event.name === "MarketStatusChanged",
  )
    ? await registry
        .getMarket(BigInt(releaseConfig.marketId))
        .then((configured: readonly unknown[]) => ({
          configVersion: releaseConfig.configVersion,
          marketId: releaseConfig.marketId,
          creditcoinChainId: BigInt(releaseConfig.creditcoin.id),
          sourceChainKey: configured[0] as bigint,
          foreignChainId: BigInt(releaseConfig.foreign.id),
          foreignToken: String(configured[1]).toLowerCase(),
          foreignTokenDecimals: Number(configured[2]),
          settlementToken: String(configured[3]).toLowerCase(),
          settlementTokenDecimals: Number(configured[4]),
          enabled: Boolean(configured[5]),
          lastCanonicalBlock: safeHead,
          updatedAt: new Date(),
        }))
    : undefined;
  await db.transaction(async (tx) => {
    for (const { address, log, name, payload } of decoded) {
      await tx
        .insert(protocolEvents)
        .values({
          chainId: BigInt(releaseConfig.creditcoin.id),
          contractAddress: address.toLowerCase(),
          blockNumber: BigInt(log.blockNumber),
          blockHash: log.blockHash!.toLowerCase(),
          transactionHash: log.transactionHash!.toLowerCase(),
          transactionIndex: log.transactionIndex,
          logIndex: log.index,
          eventName: name,
          mandateId: payload.mandateId ? String(payload.mandateId) : null,
          reservationId: payload.reservationId
            ? String(payload.reservationId)
            : null,
          payload,
          confirmedAtBlock: safeHead,
        })
        .onConflictDoNothing();
      if (name === "ReservationSettled" && payload.reservationId) {
        const candidate = await tx.query.foreignTransactions.findFirst({
          where: and(
            eq(foreignTransactions.configVersion, releaseConfig.configVersion),
            eq(
              foreignTransactions.reservationId,
              String(payload.reservationId),
            ),
            eq(
              foreignTransactions.observedBlockNumber,
              BigInt(String(payload.blockHeight)),
            ),
            eq(
              foreignTransactions.transactionIndex,
              BigInt(String(payload.transactionIndex)),
            ),
          ),
        });
        if (candidate)
          await tx
            .insert(settlementReceipts)
            .values({
              configVersion: releaseConfig.configVersion,
              reservationId: String(payload.reservationId),
              mandateId: String(payload.mandateId),
              foreignTransactionId: candidate.id,
              foreignTxHash: candidate.transactionHash,
              sourceChainKey: BigInt(String(payload.sourceChainKey)),
              blockHeight: BigInt(String(payload.blockHeight)),
              transactionIndex: BigInt(String(payload.transactionIndex)),
              transferLogIndex: BigInt(String(payload.transferLogIndex)),
              replayIdentity: String(payload.replayIdentity).toLowerCase(),
              token: String(payload.token).toLowerCase(),
              solver: String(payload.solver).toLowerCase(),
              recipient: String(payload.recipient).toLowerCase(),
              relayer: String(payload.relayer).toLowerCase(),
              deliveredAmount: String(payload.deliveredAmount),
              creditedAmount: String(payload.creditedAmount),
              lockedPayout: String(payload.lockedPayout),
              returnedBond: String(payload.returnedBond),
              creditcoinSettlementTxHash: log.transactionHash.toLowerCase(),
              settlementBlockNumber: BigInt(log.blockNumber),
              projectedAt: new Date(),
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [
                settlementReceipts.configVersion,
                settlementReceipts.reservationId,
              ],
              set: {
                creditcoinSettlementTxHash: log.transactionHash.toLowerCase(),
                settlementBlockNumber: BigInt(log.blockNumber),
                updatedAt: new Date(),
              },
            });
      }
    }
    for (const row of reservationRows)
      await tx
        .insert(reservations)
        .values(row)
        .onConflictDoUpdate({
          target: [reservations.configVersion, reservations.reservationId],
          set: {
            mandateId: row.mandateId,
            solver: row.solver,
            quantity: row.quantity,
            lockedPayout: row.lockedPayout,
            bondAmount: row.bondAmount,
            status: row.status,
            lastCanonicalBlock: row.lastCanonicalBlock,
            updatedAt: row.updatedAt,
          },
        });
    for (const row of mandateRows)
      await tx
        .insert(mandates)
        .values(row)
        .onConflictDoUpdate({
          target: [mandates.configVersion, mandates.mandateId],
          set: {
            acquiredAmount: row.acquiredAmount,
            reservedAmount: row.reservedAmount,
            funded: row.funded,
            spent: row.spent,
            reservedBudget: row.reservedBudget,
            freeBudget: row.freeBudget,
            refunded: row.refunded,
            status: row.status,
            lastCanonicalBlock: row.lastCanonicalBlock,
            updatedAt: row.updatedAt,
          },
        });
    if (marketRow)
      await tx
        .insert(markets)
        .values(marketRow)
        .onConflictDoUpdate({
          target: [markets.configVersion, markets.marketId],
          set: {
            enabled: marketRow.enabled,
            lastCanonicalBlock: marketRow.lastCanonicalBlock,
            updatedAt: marketRow.updatedAt,
          },
        });
    await tx
      .insert(syncCursors)
      .values({
        configVersion: releaseConfig.configVersion,
        streamKey: "indexer",
        chainId: BigInt(releaseConfig.creditcoin.id),
        nextBlock: toBlock + 1n,
        lastSafeBlock: toBlock,
        lastSafeBlockHash: safeBlock?.hash?.toLowerCase(),
        heartbeatAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [syncCursors.configVersion, syncCursors.streamKey],
        set: {
          nextBlock: toBlock + 1n,
          lastSafeBlock: toBlock,
          lastSafeBlockHash: safeBlock?.hash?.toLowerCase(),
          heartbeatAt: new Date(),
          updatedAt: new Date(),
        },
      });
  });
  return Number(toBlock - nextBlock + 1n);
}

async function fetchLogsAdaptive(
  provider: JsonRpcProvider,
  address: string,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<Log[]> {
  try {
    return await provider.getLogs({ address, fromBlock, toBlock });
  } catch (error) {
    if (fromBlock === toBlock) throw error;
    const midpoint = fromBlock + (toBlock - fromBlock) / 2n;
    const [left, right] = await Promise.all([
      fetchLogsAdaptive(provider, address, fromBlock, midpoint),
      fetchLogsAdaptive(provider, address, midpoint + 1n, toBlock),
    ]);
    return [...left, ...right];
  }
}

async function updateCursor(
  db: ReturnType<typeof getDatabase>,
  nextBlock: bigint,
  lastSafeBlock?: bigint | null,
  lastSafeBlockHash?: string | null,
) {
  await db
    .insert(syncCursors)
    .values({
      configVersion: releaseConfig.configVersion,
      streamKey: "indexer",
      chainId: BigInt(releaseConfig.creditcoin.id),
      nextBlock,
      lastSafeBlock,
      lastSafeBlockHash,
      heartbeatAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [syncCursors.configVersion, syncCursors.streamKey],
      set: { heartbeatAt: new Date(), updatedAt: new Date() },
    });
}

function jsonValue(value: unknown): string | number | boolean | null {
  if (typeof value === "bigint") return value.toString();
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  )
    return value;
  return String(value);
}
