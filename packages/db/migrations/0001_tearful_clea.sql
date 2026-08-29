DROP INDEX "mozy"."proof_jobs_due_idx";--> statement-breakpoint
CREATE INDEX "proof_jobs_due_idx" ON "mozy"."proof_jobs" USING btree ("next_attempt_at") WHERE "mozy"."proof_jobs"."status" NOT IN ('CONFIRMED', 'TERMINAL_REJECTED');--> statement-breakpoint
ALTER TABLE "mozy"."proof_jobs" ADD CONSTRAINT "proof_jobs_hash_shape" CHECK ("mozy"."proof_jobs"."foreign_tx_hash" ~ '^0x[0-9a-f]{64}$');