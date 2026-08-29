# Security model

This document describes the implemented testnet release at configuration `attestcoin-spike-cc3-sepolia-2026-08-25`. It is a threat model and operational boundary, not an audit report or a production-readiness claim.

## Assets and trust boundaries

The protected economic assets are buyer-funded BTKT, each reservation’s locked payout, isolated solver bonds, and the uniqueness of authenticated delivery receipts. TEST is never held by Mozy: it moves directly from a solver to the buyer on Ethereum Sepolia.

The Creditcoin contracts are the economic authority. Attestcoin authenticates foreign receipt data. Ethereum Sepolia supplies the original transaction and receipt. The web application, relayer, worker, indexer, database, RPC providers, and explorers help users submit or observe state but cannot independently authorize payout.

## On-chain invariants

- A mandate becomes open only after its complete maximum budget is funded.
- Reservation creation recomputes the quote and atomically locks quantity, payout, immutable solver identity, source window, and bond.
- Settlement pays only the stored solver and only the locked payout. A relayer cannot provide another payee.
- The reservation must still be active, the authenticated source height must be within its inclusive window, and replay identity must be unused.
- The proof must authenticate the configured source chain and a successful Ethereum receipt.
- The transaction must target the configured TEST token and encode direct `transfer(address,uint256)` to the stored buyer delivery wallet.
- The qualifying `Transfer` log must be emitted by TEST, name the stored solver as sender and buyer wallet as recipient, and contain at least the reserved amount.
- Overdelivery credits only the reserved quantity and never increases locked payout.
- Settlement updates accounting and replay state before external token transfers and is protected against reentrancy.
- Expiry and settlement are mutually exclusive terminal transitions under EVM serialization. Eligible expiry releases quantity and payout and forfeits the isolated bond to the stored buyer.

Detailed accounting and source-height rules are in [`settlement-model.md`](settlement-model.md).

## Threats and controls

### Wrong or failed delivery

A failed receipt, wrong chain, wrong token transaction target, non-transfer calldata, wrong log emitter, wrong sender, wrong recipient, insufficient amount, ambiguous qualifying log, or out-of-window source height is rejected. Client-side inspection improves feedback, but the on-chain settlement checks remain authoritative.

Only the curated standard ERC-20 behavior is supported. Fee-on-transfer, callback-heavy, rebasing, or otherwise incompatible token behavior is outside the release. Vault funding and payout measure balance changes and reject short, false-return, or incompatible transfers.

### Replay and reservation substitution

Replay identity derives from authenticated chain key, source block height, and transaction index. `MozySettlement` records its reservation and refuses reuse. The proof is checked against the reservation ID supplied to settlement and against the reservation’s immutable token, solver, recipient, quantity, and source boundaries. A valid delivery for one reservation cannot be redirected to another.

### Reservation griefing

Exclusive reservation capacity could otherwise be abandoned at no cost. The solver posts a bond equal to 100 basis points of locked payout, capped at 10 BTKT for this release. Successful settlement returns it. After both the displayed Creditcoin deadline and authenticated source-height eligibility have passed, anyone may expire an unresolved reservation; payout and quantity become available again and the bond goes to the buyer.

The bond reduces but does not eliminate griefing or off-chain inventory risk. It is not insurance and does not guarantee solver performance.

### Buyer cancellation and payout races

Cancellation exposes only free, unreserved budget for refund. Active reservations preserve their locked payout and can still settle. Permissionless eligible expiry can release unresolved reservations. If cancellation/refund, expiry, and settlement compete, contract state and transaction ordering determine which valid transition succeeds; accounting prevents the same capital from being paid or refunded twice.

### Relayer and worker compromise

Settlement submission is permissionless, while payout is bound to the stored solver. A compromised relayer can delay, waste its own gas, or submit invalid calls that revert; it cannot redirect payout or weaken proof validation. A compromised worker or database can hide, delay, duplicate, or mislabel projected activity. It cannot forge a successful canonical settlement without a valid proof and reservation semantics.

The relayer key must be a dedicated disposable CC3 testnet key holding only enough tCTC for settlement gas. It must never be reused as buyer, solver, deployer, protocol admin, or faucet. The worker must not log proof payloads, credentials, raw signatures, or private RPC URLs.

### Indexer and projection compromise

Activity and Delivery Receipts are derived projections. Loss or corruption can affect availability and presentation. They are rebuildable from the deployment block and canonical events. Product code must not infer economic finality solely from Postgres; settled state and event evidence must reconcile with Creditcoin.

### Configuration mismatch

A chain, token, verifier, decoder, contract, or package mismatch can make valid-looking evidence unsafe. Release configuration validates the deployment config version and chain identity before the app or worker starts. The documentation consistency check covers the small duplicated public fact table. Operators must stop rather than substitute guessed addresses or a convenient RPC’s chain.

## Key and credential handling

- Keep secrets only in ignored `.env` or runtime secret storage. Never use `NEXT_PUBLIC_` for private keys, database credentials, proof-builder credentials, Upstash tokens, or private RPC URLs.
- Use disposable testnet keys. Separate deployer/admin, worker relayer, Sepolia dispenser, and Creditcoin dispenser roles.
- Do not paste keys, seed phrases, database URLs, or credential-bearing command output into issues, artifacts, Activity, or Delivery Receipts.
- Inspect a submitted transaction hash before retrying. Source transfers and network writes are never retried blindly.
- Restrict the private `mozy` Postgres schema from the Supabase Data API and use the documented pooler/direct connection roles.

## Known limitations and deferred work

The release is testnet-only, non-upgradeable, limited to one market and one standard TEST/BTKT pair, and binds one solver Ethereum address across both chains. Proof and attestation latency have no fixed ETA. Mozy does not rebalance solver inventory. Worker liveness is operationally important even though it has no economic authority.

The contracts have not been audited or formally verified. Production key custody, multi-provider availability, monitoring/alerting, incident ownership, external security review, broader token-behavior analysis, and mainnet deployment work are deferred. No claim in this repository should imply those controls already exist.
