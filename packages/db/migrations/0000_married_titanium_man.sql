CREATE SCHEMA "mozy";
--> statement-breakpoint
CREATE TYPE "mozy"."candidate_source" AS ENUM('composer', 'external');--> statement-breakpoint
CREATE TYPE "mozy"."proof_job_status" AS ENUM('DETECTED', 'WAITING_SOURCE_CONFIRMATION', 'WAITING_ATTESTATION', 'PROOF_READY', 'SUBMITTING', 'CONFIRMED', 'RETRYABLE', 'TERMINAL_REJECTED');--> statement-breakpoint
CREATE TYPE "mozy"."semantic_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "mozy"."foreign_transactions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"config_version" text NOT NULL,
	"reservation_id" numeric(78, 0) NOT NULL,
	"foreign_chain_id" bigint NOT NULL,
	"source_chain_key" bigint NOT NULL,
	"transaction_hash" text NOT NULL,
	"solver" text NOT NULL,
	"source" "mozy"."candidate_source" NOT NULL,
	"replaces_transaction_id" bigint,
	"preferred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone,
	"observed_block_number" bigint,
	"observed_block_hash" text,
	"transaction_index" bigint,
	"receipt_status" smallint,
	"transaction_to" text,
	"transfer_from" text,
	"transfer_to" text,
	"transfer_amount" numeric(78, 0),
	"transfer_log_index" bigint,
	"semantic_status" "mozy"."semantic_status" DEFAULT 'pending' NOT NULL,
	"rejection_class" text,
	"rejection_detail_safe" text,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"observed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "foreign_transactions_candidate_uq" UNIQUE("config_version","reservation_id","transaction_hash"),
	CONSTRAINT "foreign_transactions_hash_shape" CHECK ("mozy"."foreign_transactions"."transaction_hash" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "foreign_transactions_solver_shape" CHECK ("mozy"."foreign_transactions"."solver" ~ '^0x[0-9a-f]{40}$')
);
--> statement-breakpoint
CREATE TABLE "mozy"."mandates" (
	"config_version" text NOT NULL,
	"mandate_id" numeric(78, 0) NOT NULL,
	"market_id" numeric(78, 0) NOT NULL,
	"buyer" text NOT NULL,
	"delivery_wallet" text NOT NULL,
	"target_amount" numeric(78, 0) NOT NULL,
	"acquired_amount" numeric(78, 0) NOT NULL,
	"reserved_amount" numeric(78, 0) NOT NULL,
	"pricing_mode" smallint NOT NULL,
	"start_price" numeric(78, 0) NOT NULL,
	"end_price" numeric(78, 0) NOT NULL,
	"required_funding" numeric(78, 0) NOT NULL,
	"settlement_token" text NOT NULL,
	"funded" numeric(78, 0) NOT NULL,
	"spent" numeric(78, 0) NOT NULL,
	"reserved_budget" numeric(78, 0) NOT NULL,
	"free_budget" numeric(78, 0) NOT NULL,
	"refunded" numeric(78, 0) NOT NULL,
	"mandate_expiry" bigint NOT NULL,
	"reservation_duration" bigint NOT NULL,
	"created_at_chain" bigint NOT NULL,
	"status" smallint NOT NULL,
	"last_canonical_block" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mandates_config_version_mandate_id_pk" PRIMARY KEY("config_version","mandate_id")
);
--> statement-breakpoint
CREATE TABLE "mozy"."markets" (
	"config_version" text NOT NULL,
	"market_id" numeric(78, 0) NOT NULL,
	"creditcoin_chain_id" bigint NOT NULL,
	"source_chain_key" bigint NOT NULL,
	"foreign_chain_id" bigint NOT NULL,
	"foreign_token" text NOT NULL,
	"foreign_token_decimals" smallint NOT NULL,
	"settlement_token" text NOT NULL,
	"settlement_token_decimals" smallint NOT NULL,
	"enabled" boolean NOT NULL,
	"last_canonical_block" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "markets_config_version_market_id_pk" PRIMARY KEY("config_version","market_id")
);
--> statement-breakpoint
CREATE TABLE "mozy"."proof_jobs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"foreign_transaction_id" bigint NOT NULL,
	"reservation_id" numeric(78, 0) NOT NULL,
	"foreign_tx_hash" text NOT NULL,
	"source_chain_key" bigint NOT NULL,
	"status" "mozy"."proof_job_status" DEFAULT 'DETECTED' NOT NULL,
	"resume_status" "mozy"."proof_job_status",
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"last_error_class" text,
	"last_error_detail_safe" text,
	"proof_version" text,
	"proof_payload" jsonb,
	"proof_checksum" text,
	"creditcoin_settlement_tx_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "proof_jobs_candidate_uq" UNIQUE("foreign_transaction_id"),
	CONSTRAINT "proof_jobs_attempt_nonnegative" CHECK ("mozy"."proof_jobs"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "mozy"."protocol_events" (
	"chain_id" bigint NOT NULL,
	"contract_address" text NOT NULL,
	"block_number" bigint NOT NULL,
	"block_hash" text NOT NULL,
	"transaction_hash" text NOT NULL,
	"transaction_index" integer NOT NULL,
	"log_index" integer NOT NULL,
	"event_name" text NOT NULL,
	"mandate_id" numeric(78, 0),
	"reservation_id" numeric(78, 0),
	"payload" jsonb NOT NULL,
	"confirmed_at_block" bigint NOT NULL,
	"orphaned_at" timestamp with time zone,
	"projected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "protocol_events_chain_id_transaction_hash_log_index_pk" PRIMARY KEY("chain_id","transaction_hash","log_index")
);
--> statement-breakpoint
CREATE TABLE "mozy"."reservations" (
	"config_version" text NOT NULL,
	"reservation_id" numeric(78, 0) NOT NULL,
	"mandate_id" numeric(78, 0) NOT NULL,
	"solver" text NOT NULL,
	"quantity" numeric(78, 0) NOT NULL,
	"locked_payout" numeric(78, 0) NOT NULL,
	"bond_amount" numeric(78, 0) NOT NULL,
	"created_at_chain" bigint NOT NULL,
	"delivery_deadline" bigint NOT NULL,
	"source_start_height" bigint NOT NULL,
	"source_end_height" bigint NOT NULL,
	"expiry_eligible_height" bigint NOT NULL,
	"status" smallint NOT NULL,
	"last_canonical_block" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_config_version_reservation_id_pk" PRIMARY KEY("config_version","reservation_id")
);
--> statement-breakpoint
CREATE TABLE "mozy"."settlement_receipts" (
	"config_version" text NOT NULL,
	"reservation_id" numeric(78, 0) NOT NULL,
	"mandate_id" numeric(78, 0) NOT NULL,
	"foreign_transaction_id" bigint NOT NULL,
	"foreign_tx_hash" text NOT NULL,
	"source_chain_key" bigint NOT NULL,
	"block_height" bigint NOT NULL,
	"transaction_index" bigint NOT NULL,
	"transfer_log_index" bigint NOT NULL,
	"replay_identity" text NOT NULL,
	"token" text NOT NULL,
	"solver" text NOT NULL,
	"recipient" text NOT NULL,
	"relayer" text NOT NULL,
	"delivered_amount" numeric(78, 0) NOT NULL,
	"credited_amount" numeric(78, 0) NOT NULL,
	"locked_payout" numeric(78, 0) NOT NULL,
	"returned_bond" numeric(78, 0) NOT NULL,
	"creditcoin_settlement_tx_hash" text NOT NULL,
	"settlement_block_number" bigint NOT NULL,
	"projected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlement_receipts_config_version_reservation_id_pk" PRIMARY KEY("config_version","reservation_id")
);
--> statement-breakpoint
CREATE TABLE "mozy"."sync_cursors" (
	"config_version" text NOT NULL,
	"stream_key" text NOT NULL,
	"chain_id" bigint,
	"contract_address" text,
	"next_block" bigint,
	"last_safe_block" bigint,
	"last_safe_block_hash" text,
	"heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_cursors_config_version_stream_key_pk" PRIMARY KEY("config_version","stream_key")
);
--> statement-breakpoint
ALTER TABLE "mozy"."proof_jobs" ADD CONSTRAINT "proof_jobs_foreign_transaction_id_foreign_transactions_id_fk" FOREIGN KEY ("foreign_transaction_id") REFERENCES "mozy"."foreign_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "foreign_transactions_reservation_idx" ON "mozy"."foreign_transactions" USING btree ("config_version","reservation_id");--> statement-breakpoint
CREATE INDEX "foreign_transactions_replaces_idx" ON "mozy"."foreign_transactions" USING btree ("replaces_transaction_id");--> statement-breakpoint
CREATE INDEX "proof_jobs_due_idx" ON "mozy"."proof_jobs" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "proof_jobs_lease_idx" ON "mozy"."proof_jobs" USING btree ("lease_expires_at");--> statement-breakpoint
CREATE INDEX "protocol_events_entity_idx" ON "mozy"."protocol_events" USING btree ("reservation_id","mandate_id");--> statement-breakpoint
CREATE INDEX "reservations_solver_status_idx" ON "mozy"."reservations" USING btree ("config_version","solver","status");--> statement-breakpoint
CREATE INDEX "reservations_mandate_status_idx" ON "mozy"."reservations" USING btree ("config_version","mandate_id","status");
--> statement-breakpoint
DO $$ BEGIN
  REVOKE ALL ON SCHEMA "mozy" FROM anon, authenticated;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
