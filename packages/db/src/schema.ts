import {
  bigint,
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSchema,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const mozy = pgSchema("mozy");
export const candidateSource = mozy.enum("candidate_source", [
  "composer",
  "external",
]);
export const semanticStatus = mozy.enum("semantic_status", [
  "pending",
  "accepted",
  "rejected",
]);
export const proofJobStatus = mozy.enum("proof_job_status", [
  "DETECTED",
  "WAITING_SOURCE_CONFIRMATION",
  "WAITING_ATTESTATION",
  "PROOF_READY",
  "SUBMITTING",
  "CONFIRMED",
  "RETRYABLE",
  "TERMINAL_REJECTED",
]);

const uint256 = (name: string) => numeric(name, { precision: 78, scale: 0 });
const now = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" }).defaultNow().notNull();

export const markets = mozy.table(
  "markets",
  {
    configVersion: text("config_version").notNull(),
    marketId: uint256("market_id").notNull(),
    creditcoinChainId: bigint("creditcoin_chain_id", {
      mode: "bigint",
    }).notNull(),
    sourceChainKey: bigint("source_chain_key", { mode: "bigint" }).notNull(),
    foreignChainId: bigint("foreign_chain_id", { mode: "bigint" }).notNull(),
    foreignToken: text("foreign_token").notNull(),
    foreignTokenDecimals: smallint("foreign_token_decimals").notNull(),
    settlementToken: text("settlement_token").notNull(),
    settlementTokenDecimals: smallint("settlement_token_decimals").notNull(),
    enabled: boolean("enabled").notNull(),
    lastCanonicalBlock: bigint("last_canonical_block", {
      mode: "bigint",
    }).notNull(),
    updatedAt: now("updated_at"),
  },
  (table) => [primaryKey({ columns: [table.configVersion, table.marketId] })],
);

export const mandates = mozy.table(
  "mandates",
  {
    configVersion: text("config_version").notNull(),
    mandateId: uint256("mandate_id").notNull(),
    marketId: uint256("market_id").notNull(),
    buyer: text("buyer").notNull(),
    deliveryWallet: text("delivery_wallet").notNull(),
    targetAmount: uint256("target_amount").notNull(),
    acquiredAmount: uint256("acquired_amount").notNull(),
    reservedAmount: uint256("reserved_amount").notNull(),
    pricingMode: smallint("pricing_mode").notNull(),
    startPrice: uint256("start_price").notNull(),
    endPrice: uint256("end_price").notNull(),
    requiredFunding: uint256("required_funding").notNull(),
    settlementToken: text("settlement_token").notNull(),
    funded: uint256("funded").notNull(),
    spent: uint256("spent").notNull(),
    reservedBudget: uint256("reserved_budget").notNull(),
    freeBudget: uint256("free_budget").notNull(),
    refunded: uint256("refunded").notNull(),
    mandateExpiry: bigint("mandate_expiry", { mode: "bigint" }).notNull(),
    reservationDuration: bigint("reservation_duration", {
      mode: "bigint",
    }).notNull(),
    createdAtChain: bigint("created_at_chain", { mode: "bigint" }).notNull(),
    status: smallint("status").notNull(),
    lastCanonicalBlock: bigint("last_canonical_block", {
      mode: "bigint",
    }).notNull(),
    updatedAt: now("updated_at"),
  },
  (table) => [primaryKey({ columns: [table.configVersion, table.mandateId] })],
);

export const reservations = mozy.table(
  "reservations",
  {
    configVersion: text("config_version").notNull(),
    reservationId: uint256("reservation_id").notNull(),
    mandateId: uint256("mandate_id").notNull(),
    solver: text("solver").notNull(),
    quantity: uint256("quantity").notNull(),
    lockedPayout: uint256("locked_payout").notNull(),
    bondAmount: uint256("bond_amount").notNull(),
    createdAtChain: bigint("created_at_chain", { mode: "bigint" }).notNull(),
    deliveryDeadline: bigint("delivery_deadline", { mode: "bigint" }).notNull(),
    sourceStartHeight: bigint("source_start_height", {
      mode: "bigint",
    }).notNull(),
    sourceEndHeight: bigint("source_end_height", { mode: "bigint" }).notNull(),
    expiryEligibleHeight: bigint("expiry_eligible_height", {
      mode: "bigint",
    }).notNull(),
    status: smallint("status").notNull(),
    lastCanonicalBlock: bigint("last_canonical_block", {
      mode: "bigint",
    }).notNull(),
    updatedAt: now("updated_at"),
  },
  (table) => [
    primaryKey({ columns: [table.configVersion, table.reservationId] }),
    index("reservations_solver_status_idx").on(
      table.configVersion,
      table.solver,
      table.status,
    ),
    index("reservations_mandate_status_idx").on(
      table.configVersion,
      table.mandateId,
      table.status,
    ),
  ],
);

export const foreignTransactions = mozy.table(
  "foreign_transactions",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    configVersion: text("config_version").notNull(),
    reservationId: uint256("reservation_id").notNull(),
    foreignChainId: bigint("foreign_chain_id", { mode: "bigint" }).notNull(),
    sourceChainKey: bigint("source_chain_key", { mode: "bigint" }).notNull(),
    transactionHash: text("transaction_hash").notNull(),
    solver: text("solver").notNull(),
    source: candidateSource("source").notNull(),
    replacesTransactionId: bigint("replaces_transaction_id", {
      mode: "bigint",
    }),
    preferredAt: now("preferred_at"),
    supersededAt: timestamp("superseded_at", {
      withTimezone: true,
      mode: "date",
    }),
    observedBlockNumber: bigint("observed_block_number", { mode: "bigint" }),
    observedBlockHash: text("observed_block_hash"),
    transactionIndex: bigint("transaction_index", { mode: "bigint" }),
    receiptStatus: smallint("receipt_status"),
    transactionTo: text("transaction_to"),
    transferFrom: text("transfer_from"),
    transferTo: text("transfer_to"),
    transferAmount: uint256("transfer_amount"),
    transferLogIndex: bigint("transfer_log_index", { mode: "bigint" }),
    semanticStatus: semanticStatus("semantic_status")
      .default("pending")
      .notNull(),
    rejectionClass: text("rejection_class"),
    rejectionDetailSafe: text("rejection_detail_safe"),
    registeredAt: now("registered_at"),
    observedAt: timestamp("observed_at", { withTimezone: true, mode: "date" }),
    updatedAt: now("updated_at"),
  },
  (table) => [
    unique("foreign_transactions_candidate_uq").on(
      table.configVersion,
      table.reservationId,
      table.transactionHash,
    ),
    index("foreign_transactions_reservation_idx").on(
      table.configVersion,
      table.reservationId,
    ),
    index("foreign_transactions_replaces_idx").on(table.replacesTransactionId),
    check(
      "foreign_transactions_hash_shape",
      sql`${table.transactionHash} ~ '^0x[0-9a-f]{64}$'`,
    ),
    check(
      "foreign_transactions_solver_shape",
      sql`${table.solver} ~ '^0x[0-9a-f]{40}$'`,
    ),
  ],
);

export const proofJobs = mozy.table(
  "proof_jobs",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    foreignTransactionId: bigint("foreign_transaction_id", { mode: "bigint" })
      .notNull()
      .references(() => foreignTransactions.id),
    reservationId: uint256("reservation_id").notNull(),
    foreignTxHash: text("foreign_tx_hash").notNull(),
    sourceChainKey: bigint("source_chain_key", { mode: "bigint" }).notNull(),
    status: proofJobStatus("status").default("DETECTED").notNull(),
    resumeStatus: proofJobStatus("resume_status"),
    attemptCount: integer("attempt_count").default(0).notNull(),
    nextAttemptAt: now("next_attempt_at"),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: timestamp("lease_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastErrorClass: text("last_error_class"),
    lastErrorDetailSafe: text("last_error_detail_safe"),
    proofVersion: text("proof_version"),
    proofPayload: jsonb("proof_payload"),
    proofChecksum: text("proof_checksum"),
    creditcoinSettlementTxHash: text("creditcoin_settlement_tx_hash"),
    createdAt: now("created_at"),
    updatedAt: now("updated_at"),
    confirmedAt: timestamp("confirmed_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    unique("proof_jobs_candidate_uq").on(table.foreignTransactionId),
    index("proof_jobs_due_idx")
      .on(table.nextAttemptAt)
      .where(sql`${table.status} NOT IN ('CONFIRMED', 'TERMINAL_REJECTED')`),
    index("proof_jobs_lease_idx").on(table.leaseExpiresAt),
    check("proof_jobs_attempt_nonnegative", sql`${table.attemptCount} >= 0`),
    check(
      "proof_jobs_hash_shape",
      sql`${table.foreignTxHash} ~ '^0x[0-9a-f]{64}$'`,
    ),
  ],
);

export const protocolEvents = mozy.table(
  "protocol_events",
  {
    chainId: bigint("chain_id", { mode: "bigint" }).notNull(),
    contractAddress: text("contract_address").notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    blockHash: text("block_hash").notNull(),
    transactionHash: text("transaction_hash").notNull(),
    transactionIndex: integer("transaction_index").notNull(),
    logIndex: integer("log_index").notNull(),
    eventName: text("event_name").notNull(),
    mandateId: uint256("mandate_id"),
    reservationId: uint256("reservation_id"),
    payload: jsonb("payload").notNull(),
    confirmedAtBlock: bigint("confirmed_at_block", {
      mode: "bigint",
    }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }),
    orphanedAt: timestamp("orphaned_at", { withTimezone: true, mode: "date" }),
    projectedAt: now("projected_at"),
  },
  (table) => [
    primaryKey({
      columns: [table.chainId, table.transactionHash, table.logIndex],
    }),
    index("protocol_events_entity_idx").on(
      table.reservationId,
      table.mandateId,
    ),
    index("protocol_events_activity_idx").on(
      table.chainId,
      table.occurredAt,
      table.blockNumber,
      table.logIndex,
    ),
  ],
);

export const settlementReceipts = mozy.table(
  "settlement_receipts",
  {
    configVersion: text("config_version").notNull(),
    reservationId: uint256("reservation_id").notNull(),
    mandateId: uint256("mandate_id").notNull(),
    foreignTransactionId: bigint("foreign_transaction_id", {
      mode: "bigint",
    }).notNull(),
    foreignTxHash: text("foreign_tx_hash").notNull(),
    sourceChainKey: bigint("source_chain_key", { mode: "bigint" }).notNull(),
    blockHeight: bigint("block_height", { mode: "bigint" }).notNull(),
    transactionIndex: bigint("transaction_index", { mode: "bigint" }).notNull(),
    transferLogIndex: bigint("transfer_log_index", {
      mode: "bigint",
    }).notNull(),
    replayIdentity: text("replay_identity").notNull(),
    token: text("token").notNull(),
    solver: text("solver").notNull(),
    recipient: text("recipient").notNull(),
    relayer: text("relayer").notNull(),
    deliveredAmount: uint256("delivered_amount").notNull(),
    creditedAmount: uint256("credited_amount").notNull(),
    lockedPayout: uint256("locked_payout").notNull(),
    returnedBond: uint256("returned_bond").notNull(),
    creditcoinSettlementTxHash: text("creditcoin_settlement_tx_hash").notNull(),
    settlementBlockNumber: bigint("settlement_block_number", {
      mode: "bigint",
    }).notNull(),
    projectedAt: now("projected_at"),
    updatedAt: now("updated_at"),
  },
  (table) => [
    primaryKey({ columns: [table.configVersion, table.reservationId] }),
  ],
);

export const syncCursors = mozy.table(
  "sync_cursors",
  {
    configVersion: text("config_version").notNull(),
    streamKey: text("stream_key").notNull(),
    chainId: bigint("chain_id", { mode: "bigint" }),
    contractAddress: text("contract_address"),
    nextBlock: bigint("next_block", { mode: "bigint" }),
    lastSafeBlock: bigint("last_safe_block", { mode: "bigint" }),
    lastSafeBlockHash: text("last_safe_block_hash"),
    heartbeatAt: now("heartbeat_at"),
    updatedAt: now("updated_at"),
  },
  (table) => [primaryKey({ columns: [table.configVersion, table.streamKey] })],
);

export type ProofJobStatus = (typeof proofJobStatus.enumValues)[number];
