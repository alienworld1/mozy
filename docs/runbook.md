# Mozy developer and operator runbook

This is the entry point for the supported testnet release. Protocol-specific operations remain in [`protocol-runbook.md`](protocol-runbook.md); pricing and timing rules are in [`settlement-model.md`](settlement-model.md); receipt-proof setup is in [`attestcoin.md`](attestcoin.md).

## Prerequisites and install

Use Node.js compatible with the workspace, pnpm `11.17.0`, Foundry for Solidity commands, and PostgreSQL for durable worker state.

```bash
pnpm install
```

Copy the variable names from [`.env.example`](../.env.example) into ignored `.env` files as directed there. Root protocol and Attestcoin scripts read the root `.env`. Web development uses `apps/web/.env.local` or inherited runtime variables. Never commit a private key, seed phrase, database URL, provider credential, proof-builder credential, or Upstash token. Use separate disposable testnet accounts for deployer/admin, relayer, and each dispenser.

At minimum, release reads need `CREDITCOIN_RPC_URL` and `FOREIGN_RPC_URL`. The worker additionally needs `DATABASE_URL`, `ATTESTCOIN_PROOF_BUILDER_URL`, `MOZY_RELAYER_PRIVATE_KEY`, and its documented worker settings. Migrations use a direct or session database connection rather than the transaction pooler.

## Validate the repository

Run the static and local checks before starting services:

```bash
pnpm docs:check
pnpm web:lint
pnpm web:test
pnpm worker:typecheck
pnpm worker:test
pnpm attestcoin:typecheck
pnpm attestcoin:test
pnpm pricing:test
pnpm protocol:build
pnpm protocol:test
```

`pnpm web:build` also requires valid browser-safe Creditcoin and Sepolia RPC configuration because `@mozy/chain-config` intentionally fails on missing or mismatched release configuration.

## Database

Apply committed migrations with a direct or session connection:

```bash
DATABASE_MIGRATION_URL=<direct-or-session-url> pnpm db:migrate
pnpm db:test
```

The Vercel web runtime uses `DATABASE_URL` through the transaction pooler with prepared statements disabled. The persistent worker uses a direct connection when IPv6 is available or the session pooler on IPv4-only hosting. Keep the private `mozy` schema outside the Supabase Data API. Migration failure is a setup error: correct the connection or schema permissions; do not skip migrations or hand-edit projection rows. See [`deployment.md`](deployment.md) for the complete production setup.

## Inspect release configuration and evidence

The selected sources are [`config/attestcoin-environment.ts`](../config/attestcoin-environment.ts) and [`artifacts/protocol/cc3-settlement.json`](../artifacts/protocol/cc3-settlement.json). Confirm their config versions match, then run:

```bash
pnpm attestcoin:evidence:check
pnpm protocol:inspect
pnpm protocol:evidence:check
```

These are evidence/read checks. `attestcoin:evidence:check` reconciles the receipt-proof spike; `protocol:evidence:check` reconciles the current proof-to-payment run. A failure means the evidence must not be presented until fresh public chain reads agree. It is not permission to edit an artifact around the mismatch.

For a specific canonical object:

```bash
pnpm protocol:inspect --mandate 1
pnpm protocol:inspect --reservation 1
pnpm protocol:inspect --receipt <replay-identity>
```

## Start the product

Run the web and durable worker in separate terminals:

```bash
pnpm web:dev
pnpm worker:dev
```

The public `/`, `/how-mozy-works`, and configured market education are server-rendered from local content/configuration. Acquisition and verification workspaces additionally depend on wallet RPC access and, for projections, the database/worker.

`GET /api/health` reports coarse database, worker, indexer, and reconciler state. A degraded response affects liveness or presentation; it does not change canonical economic state.

## Worker restart and recovery

The worker process runs the proof worker, Creditcoin event indexer, and reconciler. It persists cursors, candidate state, proof checksums, transaction hashes, and leases. On restart:

1. verify database and both RPC connections;
2. restart with `pnpm worker:dev`;
3. inspect `/api/health` and the affected reservation;
4. allow expired 60-second job leases to be reclaimed;
5. confirm a known settlement hash is reconciled before considering another submission.

Never resend a TEST source transfer to repair a worker outage. Never clear projection tables as a first response. The indexer can resume from its stored cursor, and projections can be rebuilt from canonical events beginning at deployment block `5382887`.

## Failure classification

- **Configuration/setup:** missing variables, wrong chain, absent contract code, config-version mismatch, database permissions, or malformed saved proof. Stop and reconcile the named source; do not guess a value.
- **Retryable infrastructure:** RPC timeout, unavailable proof builder, source block not yet attested, temporary database/worker outage, or pending transaction receipt. Keep the same transaction/proof identity and retry the read or proof step later. Do not resend a source transfer or blindly repeat a network write.
- **Terminal semantic:** failed receipt, wrong token/sender/recipient/amount, ambiguous transfer, source height outside the reservation window, consumed replay identity, expired/settled reservation, or contract simulation rejection. Inspect canonical state and use a genuinely qualifying transfer/reservation path; repeated submission cannot make invalid evidence valid.
- **Submitted but unresolved:** record the hash, inspect it on the correct explorer, and reconcile the receipt before any retry.

The worker uses bounded retry backoff for retryable jobs and records terminal rejection separately. The UI does not promise a proof ETA.

## Verify an end-to-end settlement

1. Inspect the mandate and reservation on the Creditcoin explorer at `https://creditcoin-testnet.blockscout.com`.
2. Confirm the registered transaction on `https://sepolia.etherscan.io` targets TEST and contains the direct solver-to-buyer transfer.
3. Compare the source block with the reservation’s inclusive source-height window.
4. Follow the proof readiness/inspection sequence in [`attestcoin.md`](attestcoin.md).
5. Submit only an already validated proof if the worker has not submitted it:

```bash
pnpm protocol:settle --reservation <id> --proof .attestcoin/proofs/<source-tx>.json
```

6. Record the returned Creditcoin hash. Do not repeat the write automatically.
7. Re-run the reservation, replay receipt, and evidence checks:

```bash
pnpm protocol:inspect --reservation <id>
pnpm protocol:inspect --receipt <replay-identity>
pnpm protocol:evidence:check
```

Successful verification requires a canonical settled reservation, stored solver payout, returned bond, consumed replay identity, reconciled vault accounting, and matching public source/settlement transactions.

## Safe testnet operations

Test funds, contract deployment, and manual lifecycle commands are detailed in [`protocol-runbook.md`](protocol-runbook.md). Network writes are intentionally not retried automatically. Use disposable funded accounts, simulate where tooling supports it, wait for receipts, and inspect every hash before the next write. Do not use destructive database recovery commands or expose faucet/relayer keys in browser variables.
