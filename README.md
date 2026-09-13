# Mozy

Mozy is a cross-chain acquisition protocol for buying an asset on one network with funds held on another. A buyer publishes and funds an Acquisition Mandate on Creditcoin; a solver reserves part of it and transfers the requested asset directly to the buyer on Ethereum Sepolia. The solver's Creditcoin payout is released only after Attestcoin authenticates the source transaction and Mozy verifies that it satisfies the reservation.

The current deployment is intentionally narrow: TEST delivery on Ethereum Sepolia in exchange for BTKT on Creditcoin CC3 Testnet. Mozy does not custody TEST or deploy a delivery contract on Sepolia. The ordinary ERC-20 transfer receipt is the evidence used to settle the pre-funded obligation on Creditcoin.

## How settlement works

1. A buyer creates an Acquisition Mandate with a target quantity, delivery wallet, pricing rule, expiry, and reservation duration. The mandate opens after its full maximum BTKT budget is deposited into `SettlementVault`.
2. A solver reserves a quantity. `MozyMarket` recomputes the quote, locks the corresponding payout, binds the solver address, records an authenticated source-height window, and escrows a BTKT bond.
3. The same solver address calls `transfer` on the configured TEST token and sends at least the reserved quantity directly to the buyer's Sepolia wallet.
4. The worker inspects the receipt, waits for the source block to become attestable, builds an Attestcoin proof, simulates settlement, and submits it to Creditcoin.
5. `MozySettlement` verifies the proof and checks the chain, receipt status, token, calldata, transfer log, sender, recipient, amount, source height, reservation binding, and replay identity. It then pays the stored solver and returns the bond.

Overdelivery does not increase the credited quantity or payout. If an unresolved reservation becomes eligible for expiry, anyone may expire it; its payout returns to the mandate's available budget and its bond is transferred to the buyer.

## System design

```text
Buyer                         Creditcoin CC3 Testnet
  │                    ┌──────────────────────────────────────┐
  └─ fund mandate ────►│ MarketRegistry → MozyMarket         │
                       │                    │                 │
Solver                 │             SettlementVault         │
  │                    │                    ▲                 │
  │                    │              MozySettlement         │
  │                    └────────────────────▲─────────────────┘
  │                                         │ verified receipt
  └─ direct TEST transfer ─► Sepolia ─► Attestcoin

Next.js app  ─ wallet transactions and canonical reads
Worker       ─ event indexing, receipt proofs, settlement relay, reconciliation
Postgres     ─ restart-safe jobs and rebuildable activity/receipt projections
```

Creditcoin contracts are the economic source of truth. The web application, worker, relayer, and database cannot change a reservation's solver, quantity, payout, or delivery requirements. Postgres stores operational state and read models; canonical contract reads remain decisive when a projection is delayed.

The on-chain components have distinct responsibilities:

| Component | Responsibility |
| --- | --- |
| `MarketRegistry` | Stores and enables the curated TEST/BTKT market. |
| `MozyMarket` | Owns mandate and reservation terms, lifecycle, pricing, source windows, and solver bonds. |
| `SettlementVault` | Custodies buyer-funded BTKT, locked payouts, refundable balances, and isolated bonds. |
| `MozySettlement` | Verifies Attestcoin proofs, enforces delivery semantics and replay protection, and invokes settlement. |
| `PricingLibrary` | Computes deterministic integer Limit and Range quotes. |

Reservations are timed using source block heights authenticated on Creditcoin, not timestamps supplied by an RPC service or relayer. The accepted interval and the later expiry threshold are fixed when the reservation is created.

## Supported deployment

| Item | Value |
| --- | --- |
| Settlement network | Creditcoin CC3 Testnet (`102031`) |
| Delivery network | Ethereum Sepolia (`11155111`; Attestcoin source key `1`) |
| Market ID | `1` |
| Delivery asset | TEST, 18 decimals, `0x0F24FD9e0524BA53d3f0A4A40350Adf5370b4A53` |
| Settlement asset | BTKT, 18 decimals, `0x914Cf96BF28b7b4921db27b264ecEd71aC91134E` |
| Registry | `0x8b34e97cd31916F9d3A480684df3aD5B09d7B350` |
| Market | `0x4FA307e67CaB8751C4A964eeeB04e38c5655C7eE` |
| Vault | `0x1b2769736e8EdE4f892aB48486B592a7e3C9D82D` |
| Settlement | `0x6A25220617faF467f9F83cb5162CBE69BD09ea4b` |
| Deployment block | `5382887` |
| Solver bond | 1% of locked payout, capped at 10 BTKT |
| Source-height policy | 256 accepted blocks, followed by 64 grace blocks |

The versioned sources of truth are [`config/attestcoin-environment.ts`](config/attestcoin-environment.ts) and [`artifacts/protocol/cc3-settlement.json`](artifacts/protocol/cc3-settlement.json). Application code consumes their validated browser-safe projection from `@mozy/chain-config`.

All listed assets and networks are testnet-only. The contracts are non-upgradeable and have not been audited.

## Local development

### Requirements

- Node.js 24
- pnpm 11.17.0
- Foundry for Solidity builds and tests
- PostgreSQL for the worker and database-backed application views

Install the workspace and create a local environment file:

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
```

The example file contains public Creditcoin and Sepolia RPC endpoints, the configured proof-builder endpoint, and browser-safe local defaults. With those defaults, the web application can start without private keys:

```bash
pnpm web:dev
```

Open [http://localhost:3000](http://localhost:3000). Use only a disposable testnet wallet. The application connects through an injected EVM wallet and switches between Creditcoin CC3 Testnet and Ethereum Sepolia as the workflow requires.

### Run the complete verification pipeline

Activity, delivery receipts, durable transaction registration, and automated proof submission require PostgreSQL and the worker. Configure these values in `.env`:

| Variable | Used by |
| --- | --- |
| `DATABASE_URL` | Web server and worker runtime connection |
| `DATABASE_MIGRATION_URL` | Drizzle migrations using a direct or session connection |
| `CREDITCOIN_RPC_URL` | Worker and protocol tooling |
| `FOREIGN_RPC_URL` | Sepolia receipt inspection |
| `ATTESTCOIN_PROOF_BUILDER_URL` | Attestcoin proof generation and readiness checks |
| `MOZY_RELAYER_PRIVATE_KEY` | Disposable CC3 account used only to submit permissionless settlement calls |
| `MOZY_WORKER_ID` | Optional stable worker identifier; generated automatically when omitted |

Apply migrations, then run the web application and worker in separate terminals:

```bash
pnpm db:migrate
pnpm web:dev
```

```bash
pnpm worker:dev
```

The worker persists its event cursor, candidate transactions, proof jobs, proof checksums, and submitted settlement hashes. Jobs use expiring leases and bounded retries, so a restart resumes existing work rather than resending a source transfer. `GET /api/health` reports coarse database, indexer, worker, and reconciler health.

The optional test-funds dispenser is disabled by default. Enabling it additionally requires dedicated Sepolia and Creditcoin funding keys plus Upstash Redis credentials; see [the protocol runbook](docs/protocol-runbook.md#test-funds-dispenser-operations). Do not reuse buyer, solver, deployer, relayer, or real-value accounts for this service.

## Tests and validation

Contract tests use Foundry and cover pricing, mandate lifecycle, vault accounting, reservation invariants, hostile token behavior, source-height boundaries, proof semantics, replay prevention, and permissionless settlement.

```bash
pnpm protocol:build
pnpm protocol:test
pnpm pricing:test
```

The TypeScript suites cover worker error handling, durable job transitions and recovery, receipt projections, wallet registration, acquisition measurements, verification state, and documentation consistency:

```bash
pnpm attestcoin:test
pnpm attestcoin:typecheck
pnpm worker:test
pnpm worker:typecheck
pnpm db:test
pnpm web:test
pnpm web:lint
pnpm web:build
pnpm docs:check
```

## Protocol tooling

The repository includes commands for inspecting the deployed contracts and submitting an already-built proof:

```bash
pnpm protocol:inspect
pnpm protocol:inspect --mandate 1
pnpm protocol:inspect --reservation 1
pnpm protocol:inspect --receipt <replay-identity>
pnpm protocol:settle --reservation <id> --proof .attestcoin/proofs/<source-tx>.json
```

Attestcoin tooling can inspect a Sepolia receipt, retrieve proof material, and verify it through the configured Creditcoin integration:

```bash
pnpm attestcoin:preflight
pnpm attestcoin:inspect --tx <source-transaction-hash>
pnpm attestcoin:prove --tx <source-transaction-hash>
pnpm attestcoin:verify --tx <source-transaction-hash>
```

Commands that send transactions do not retry writes automatically. Inspect the returned receipt before attempting another operation. Detailed deployment and recovery procedures are in the runbooks below.

## Repository layout

```text
apps/web/              Next.js interface and server routes
apps/worker/           Persistent indexer, proof worker, and reconciler
contracts/src/         Solidity protocol contracts
contracts/test/        Foundry unit, fuzz, and invariant tests
packages/chain-config/ Validated deployment and network configuration
packages/db/           Drizzle schema, migrations, and repositories
scripts/               Attestcoin, protocol, pricing, and validation tooling
docs/                  Architecture, security, settlement, and operations guides
```

## Further reading

- [Architecture](docs/architecture.md) explains the authority boundaries and deployed topology.
- [Settlement model](docs/settlement-model.md) specifies pricing, custody accounting, bonds, and source-height timing.
- [Attestcoin integration](docs/attestcoin.md) documents proof construction and authenticated receipt fields.
- [Security model](docs/security.md) describes trust assumptions, failure modes, and current limitations.
- [Developer and operator runbook](docs/runbook.md) covers database setup, health checks, and recovery.
- [Protocol runbook](docs/protocol-runbook.md) covers local deployment, contract inspection, and settlement operations.
