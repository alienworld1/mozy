# Mozy

Mozy lets a buyer fund an Acquisition Mandate on Creditcoin CC3 and receive TEST directly in an existing Ethereum Sepolia wallet. A solver's locked BTKT payout is released only after Attestcoin authenticates the ordinary source-chain transfer and Mozy validates its token, sender, recipient, amount, timing, and replay identity.

The protocol invariant is simple: **foreign delivery → Attestcoin verification → Creditcoin settlement**. The web app and Postgres projection improve usability, but neither can create settlement authority.

## Supported release

This repository intentionally supports one testnet market:

| Item | Current value |
| --- | --- |
| Release config | `attestcoin-spike-cc3-sepolia-2026-08-25` |
| Settlement network | Creditcoin CC3 Testnet (`102031`) |
| Delivery network | Ethereum Sepolia (`11155111`, Attestcoin source key `1`) |
| TEST token | `0x0F24FD9e0524BA53d3f0A4A40350Adf5370b4A53` |
| BTKT token | `0x914Cf96BF28b7b4921db27b264ecEd71aC91134E` |
| Market ID | `1` |
| Deployment block | `5382887` |
| Market | `0x4FA307e67CaB8751C4A964eeeB04e38c5655C7eE` |
| Vault | `0x1b2769736e8EdE4f892aB48486B592a7e3C9D82D` |
| Settlement | `0x6A25220617faF467f9F83cb5162CBE69BD09ea4b` |
| Attestcoin verifier | `0x0000000000000000000000000000000000000FD2` |
| ChainInfo | `0x0000000000000000000000000000000000000fD3` |
| Decoder | `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f` |

The versioned sources of truth are [config/attestcoin-environment.ts](config/attestcoin-environment.ts) and [artifacts/protocol/cc3-settlement.json](artifacts/protocol/cc3-settlement.json). Do not copy these values into new application code.

## Prerequisites

- Node.js 24
- pnpm 11
- Foundry (`forge`) for contract builds and tests
- PostgreSQL/Supabase for the durable read model and proof jobs
- Disposable testnet-only EVM accounts. Never use a wallet that has held real assets.

## Install and configure

```bash
pnpm install --frozen-lockfile
cp .env.example .env
```

The checked-in defaults provide public CC3 and Sepolia endpoints for local reads. Set `NEXT_PUBLIC_SITE_URL` to the real HTTPS production origin before deployment. Database, proof-builder, faucet, and relayer values are needed only for the corresponding runtime paths. Private keys, database credentials, and authenticated RPC URLs must never be committed.

For a complete operated environment:

1. Create a Supabase Postgres project and set `DATABASE_URL` plus `DATABASE_MIGRATION_URL`.
2. Run `pnpm db:migrate`.
3. Configure the proof builder and a disposable CC3 relayer with `ATTESTCOIN_PROOF_BUILDER_URL` and `MOZY_RELAYER_PRIVATE_KEY`.
4. Leave `MOZY_FAUCET_ENABLED=false` unless dedicated, rate-limited testnet funding wallets and Upstash credentials are configured.

## Run locally

Use separate terminals for the web app and persistent worker:

```bash
pnpm web:dev
pnpm worker:dev
```

Open `http://localhost:3000`. The health route is `/api/health`. The worker owns indexing, reconciliation, and permissionless proof submission; it never signs buyer or solver economic actions.

## Checks

The individual offline checks are:

```bash
pnpm protocol:build
pnpm protocol:test
pnpm pricing:test
pnpm attestcoin:test
pnpm attestcoin:typecheck
pnpm worker:test
pnpm worker:typecheck
pnpm db:test
pnpm web:test
pnpm web:lint
pnpm web:build
pnpm docs:check
pnpm release:test
```

`pnpm release:check` runs the complete fail-closed sequence, including both live evidence checks and submission-manifest validation. It is read-only with respect to both chains. Run `pnpm release:check:offline` when network access is intentionally unavailable; it reports live evidence as **not run** and exits non-zero, because an offline-only result is not submission-ready.

To diagnose a failed checklist entry, run the named script directly with pnpm. The orchestrator intentionally does not echo provider output, RPC URLs, proof payloads, or database contents.

## Real lifecycle verification

1. Connect a buyer wallet on CC3 and use `/test-funds` if the disposable account needs testnet assets.
2. Create and fund an Acquisition Mandate at `/acquisitions/new`.
3. Open it in `/markets`, measure a partial fill, and reserve from the solver workspace.
4. Switch the solver wallet to Ethereum Sepolia and send TEST directly to the buyer delivery wallet, or register an already-sent qualifying transaction.
5. Observe delivery discovery and Attestcoin verification as separate states. Wait for the worker to submit the proof and for canonical CC3 settlement.
6. Inspect the Delivery Receipt from Activity, including both explorer links and the consumed replay identity.
7. Exercise rejection and recovery with the procedures in [docs/protocol-runbook.md](docs/protocol-runbook.md) and [docs/runbook.md](docs/runbook.md).

TEST, BTKT, Sepolia ETH, and tCTC in this workflow are testnet assets with no real-world value.

## Evidence status

The current release deployment is `artifacts/protocol/cc3-settlement.json`. The existing `artifacts/protocol/cc3-settlement-evidence.json` references `cc3-settlement-pre-module6.json`, so it is historical and is not published by the landing page as current evidence. A fresh successful lifecycle must generate current evidence through the established protocol command; addresses must never be rewritten by hand.

The submission gate is [artifacts/submission/evidence.json](artifacts/submission/evidence.json). Until current successful evidence, the production origin, public whitepaper/deck, and public video are supplied and revalidated, `pnpm release:check` correctly fails.

## Documentation map

- [Architecture](docs/architecture.md) — authority boundaries and deployed topology
- [Attestcoin integration](docs/attestcoin.md) — proof interface and authenticated facts
- [Settlement model](docs/settlement-model.md) — accounting and lifecycle invariants
- [Protocol runbook](docs/protocol-runbook.md) — deployment and chain-level operations
- [Operations runbook](docs/runbook.md) — web, worker, database, and recovery
- [Security](docs/security.md) — trust assumptions, threat model, and known limitations
- [Whitepaper](docs/whitepaper.md) — product and protocol narrative
- [Release audit](artifacts/submission/accessibility-responsive-audit.md) — viewport, state, and input verification path
- [Submission checklist](artifacts/submission/README.md) — final external blockers and packaging steps

## Security and limitations

Mozy is a narrow testnet release, not an audited mainnet product. It supports one configured market and standard ERC-20 transfer semantics. Testnet providers, Attestcoin proof readiness, the managed database, and the worker may be temporarily unavailable. Canonical Creditcoin state remains authoritative, settlement is permissionless, and source proofs remain subject to the pinned Attestcoin environment described in [docs/security.md](docs/security.md).
