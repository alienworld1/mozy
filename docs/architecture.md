# Mozy architecture

Implemented against release configuration `attestcoin-spike-cc3-sepolia-2026-08-25`. The canonical references are [`config/attestcoin-environment.ts`](../config/attestcoin-environment.ts) and [`artifacts/protocol/cc3-settlement.json`](../artifacts/protocol/cc3-settlement.json). This document describes the supported testnet release, not a future deployment.

## System context

```text
Buyer
  │ funds BTKT and defines delivery wallet
  ▼
Creditcoin CC3 Testnet (102031)
  MarketRegistry ─ MozyMarket ─ SettlementVault ─ MozySettlement
       │              │               │                 ▲
       │ market pins  │ reservations  │ custody         │ verified receipt
       │              │               │                 │
       └──────────────┴───────────────┘         Attestcoin verifier
                                                      ▲
                                                      │ receipt proof
Solver ── ordinary TEST transfer ──► Ethereum Sepolia (11155111)
                 directly to buyer wallet

Next.js web ─ reads canonical state and projections; submits user-authorized writes
Worker      ─ finds candidates, builds proofs, and relays permissionless settlement
Postgres    ─ restart-safe jobs, indexed events, activity, and receipt projections
```

TEST stays on Ethereum Sepolia. Attestcoin carries authenticated evidence of the receipt, not the token. The resulting Creditcoin call can release BTKT already held by `SettlementVault`.

## Canonical authority and custody

Creditcoin contracts are the economic source of truth:

- `MarketRegistry` stores the curated market definition and enablement.
- `MozyMarket` owns mandate and reservation terms, quantities, lifecycle, immutable solver binding, source-height windows, and bond policy.
- `SettlementVault` holds buyer-funded BTKT and isolated solver bonds. Its accounting invariant is documented in [`settlement-model.md`](settlement-model.md).
- `MozySettlement` invokes the pinned Attestcoin verifier, decodes the authenticated receipt, validates delivery semantics, consumes replay identity, and calls the market/vault settlement seam.

No web route, worker process, database row, relayer key, or indexer event can create a valid delivery, select another payee, or change a reservation’s locked amount. Postgres data is a rebuildable projection. The application checks canonical Creditcoin state before presenting settlement as final.

On Ethereum Sepolia, delivery uses the configured TEST contract directly. There is no Mozy delivery contract or adapter on that chain, and Mozy does not custody TEST.

## End-to-end settlement sequence

```text
Buyer       Web       Creditcoin       Solver       Sepolia       Attestcoin       Worker
  │          │             │              │             │               │              │
  │ create, approve, fund ─►│              │             │               │              │
  │          │ mandate Open │              │             │               │              │
  │          │             │◄─ reserve + bond ──────────│               │              │
  │          │             │  lock quantity/payout      │               │              │
  │          │             │              │─ TEST transfer ─────────────►│              │
  │          │             │              │             │ receipt       │              │
  │          │             │              │             │◄─ inspect ───────────────────│
  │          │             │              │             │─ proof request ►│             │
  │          │             │              │             │               │─ proof ──────►│
  │          │             │◄──────── permissionless settle(proof) ─────────────────────│
  │          │             │ verify + semantic checks + replay consumption              │
  │          │             │ pay stored solver + return bond                            │
  │          │◄── canonical reads / indexed projection ──────────────────────────────────│
```

1. The buyer creates an Acquisition Mandate, approves BTKT, and fully funds its maximum budget. Only full funding opens demand.
2. A solver quotes and creates a Fill Reservation. The contract recomputes price, moves payout from free to reserved budget, binds the solver address, and escrows the bond atomically.
3. The solver calls `transfer` on TEST from the same address and sends at least the reserved quantity directly to the stored buyer delivery wallet.
4. Candidate inspection rejects failed receipts, wrong transactions, ambiguous transfers, and transfers outside the reservation binding before proof submission.
5. Attestcoin’s proof builder becomes ready only after its attested height reaches the transaction’s source block. The proof authenticates the receipt and its source height.
6. Any relayer may call `MozySettlement.settle`. The contract verifies the proof and checks the chain, successful receipt, TEST transaction target, direct transfer call, TEST log emitter, sender, recipient, minimum amount, inclusive source window, transaction/log identity, reservation, and unused replay identity.
7. Settlement spends only the locked payout, pays the stored solver, returns the isolated bond, marks the reservation settled, and records the consumed receipt identity.

## Application and service responsibilities

The Next.js application renders public markets, buyer acquisition controls, the solver workspace, Activity, and Delivery Receipts. It uses browser-safe validated release configuration and wallet-authorized transactions. Server routes accept candidate registration and serve coarse projections; they do not settle reservations by decree.

The durable worker contains three cooperating loops:

- the indexer starts from deployment block `5382887`, records canonical Creditcoin events, and advances a persisted cursor;
- the proof worker leases registered candidates, inspects source receipts, waits for source confirmation and attestation, persists validated proofs, simulates settlement, submits once, and reconciles the receipt;
- the reconciler compares pending submissions and projections with canonical state so restarts or delayed receipts do not create duplicate economic transitions.

Jobs use expiring leases and bounded retry scheduling. Restarting a process may delay progress but does not resend the source transfer. Known settlement hashes are reconciled before another submission.

## Public API boundary

The public web API registers wallet-authenticated transaction candidates, exposes reservation verification projections, Activity, receipts, test-fund allocation, and coarse health. Candidate registration cannot alter immutable reservation terms. Health and projection endpoints are informational. Canonical contract reads remain decisive when projections lag.

## Deployment facts

<!-- docs-check:release-facts -->

| Fact | Current value |
|---|---|
| Config version | `attestcoin-spike-cc3-sepolia-2026-08-25` |
| Settlement chain | Creditcoin CC3 Testnet, chain `102031` |
| Delivery chain | Ethereum Sepolia, chain `11155111`, source key `1` |
| Delivery token | TEST, 18 decimals, `0x0F24FD9e0524BA53d3f0A4A40350Adf5370b4A53` |
| Settlement token | BTKT, 18 decimals, `0x914Cf96BF28b7b4921db27b264ecEd71aC91134E` |
| Market | `1` |
| Registry | `0x8b34e97cd31916F9d3A480684df3aD5B09d7B350` |
| Market contract | `0x4FA307e67CaB8751C4A964eeeB04e38c5655C7eE` |
| Vault | `0x1b2769736e8EdE4f892aB48486B592a7e3C9D82D` |
| Settlement | `0x6A25220617faF467f9F83cb5162CBE69BD09ea4b` |
| Attestcoin verifier | `0x0000000000000000000000000000000000000FD2` |
| ChainInfo | `0x0000000000000000000000000000000000000fD3` |
| EVM v1 decoder | `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f` |
| Bond | `100` bps, cap `10000000000000000000` base units, denominator `10000` |
| Source policy | `256` accepted blocks, `64` grace blocks, `inclusive` bounds |
| Deployment block | `5382887` |
| Attestcoin packages | `@gluwa/usc-contracts@0.1.2`, `@gluwa/usc-sdk@0.18.0` |

The deployment artifact owns contract identity and immutable policy. The TypeScript environment owns chain, token, explorer, official integration, and package pins. `@mozy/chain-config` validates and combines the browser-safe subset; configuration mismatch fails startup/build.

## Explicit non-goals

This release has one curated testnet market. It does not provide arbitrary markets, multiple delivery chains, token custody on the delivery chain, solver inventory rebalancing, privileged fulfillment, upgradeability, a production deployment, or an audited security claim. See [`security.md`](security.md), [`attestcoin.md`](attestcoin.md), and [`runbook.md`](runbook.md).
