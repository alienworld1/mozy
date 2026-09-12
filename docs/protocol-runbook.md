# Protocol runbook

## Local verification

Install root dependencies, then run:

```bash
pnpm protocol:build
pnpm pricing:test
pnpm protocol:test
pnpm attestcoin:typecheck
```

The Foundry suite covers Limit and Range fixtures, mandate lifecycle and accounting, canonical reservation quotes, stale-quote rollback, immutable solver binding, deadline boundaries, isolated bonds, permissionless expiry, cross-mandate isolation, direct-transfer isolation, hostile token behavior, and future-only payout/bond-return seams.

For a persistent local chain, start Anvil in one terminal. Put one Anvil private key in `MOZY_LOCAL_PRIVATE_KEY`, then deploy with:

```bash
pnpm protocol:deploy:local
```

The Forge output lists the local token, registry, market, and vault addresses. From a fresh shell, use `cast call` against those addresses to confirm `nextMandateId()`, `getMarket(uint256)`, `getMandate(uint256)`, `getAccount(uint256)`, and `auditMandate(uint256)`. Use `cast send` from the local buyer key to approve the vault, create a mandate, fund it in two transactions, pause/resume, cancel, refund in two transactions, and close. Every write should be inspected by transaction hash before another write is submitted.

Focused automated paths are also available with:

```bash
forge test --match-test testHappyPathFundingLifecycleAndIsolation -vvvv
forge test --match-contract ReservationEngineTest -vvvv
```

## Local reservation lifecycle

The local deployment uses an immutable 100 basis-point bond rate and a 10-token cap. After creating and fully funding an open mandate through the standard mandate funding flow:

1. Read `quoteReservation(mandateId, quantity)` from `MozyMarket`. Preserve the integer `payout`, `bondAmount`, and `eligibleUntil` values.
2. From the solver account, approve `SettlementVault` for the exact `bondAmount` in the local settlement token.
3. From that same solver account, call `createReservation(mandateId, quantity, payout)`. The sender becomes the immutable solver; there is no separate solver parameter.
4. Record the returned ID or decode `ReservationCreated`, then read `getReservation(id)`, `getReservationRequirements(id)`, `getMandate(mandateId)`, `getAccount(mandateId)`, and `getBondEscrow(id)`.
5. Confirm quantity moved into `reservedAmount`, payout moved from vault `free` to `reserved`, and the bond appears only in its reservation escrow and `unresolvedBondBalance`.
6. Advance Anvil to the exact delivery deadline with `cast rpc evm_setNextBlockTimestamp <deadline>` followed by `cast rpc evm_mine`, then call `expireReservation(id)` from any account.
7. Confirm status `Expired`, released quantity and payout, buyer bond receipt, resolved escrow, and `isSolvent(token) == true`.

Writes can be submitted with `cast send` using these signatures:

```bash
cast send "$SETTLEMENT_TOKEN" "approve(address,uint256)" "$SETTLEMENT_VAULT" "$BOND_AMOUNT" --private-key "$SOLVER_PRIVATE_KEY" --rpc-url http://127.0.0.1:8545
cast send "$MOZY_MARKET" "createReservation(uint256,uint256,uint256)(uint256)" "$MANDATE_ID" "$QUANTITY" "$EXPECTED_PAYOUT" --private-key "$SOLVER_PRIVATE_KEY" --rpc-url http://127.0.0.1:8545
cast send "$MOZY_MARKET" "expireReservation(uint256)" "$RESERVATION_ID" --private-key "$CALLER_PRIVATE_KEY" --rpc-url http://127.0.0.1:8545
```

Use disposable Anvil keys only. Inspect each transaction receipt before retrying a write.

## Creditcoin deployment

Verified attestcoin receipt evidence is a release prerequisite. Revalidate it with the read-only command:

```bash
pnpm attestcoin:evidence:check
```

The deployment command requires a `verified` evidence manifest, revalidates it and the pinned public configuration before any mutation, then independently validates the live Creditcoin deployment requirements. A manual completion marker does not satisfy this gate.

Before deployment, configure a disposable testnet account in `.env`:

```text
CREDITCOIN_RPC_URL=<CC3 HTTPS RPC>
FOREIGN_RPC_URL=<Sepolia HTTPS RPC>
ATTESTCOIN_PROOF_BUILDER_URL=<pinned HTTPS proof builder>
MOZY_DEPLOYER_PRIVATE_KEY=<disposable testnet key>
MOZY_PROTOCOL_ADMIN=<same disposable account address>
MOZY_RELAYER_PRIVATE_KEY=<separate disposable CC3 relayer key>
MOZY_SOURCE_WINDOW_BLOCKS=<positive source-height span>
MOZY_SETTLEMENT_GRACE_BLOCKS=<positive proof-submission grace span>
```

The deployer must have tCTC and BTKT. Build and deploy:

```bash
pnpm protocol:build
pnpm protocol:deploy
```

The command confirms chain ID `102031`, live BTKT and decoder code, token decimals, config version, signer funding, and the nonzero policy owner before mutation. It waits for each receipt and prints each transaction hash and explorer link. It deploys `MarketRegistry`, `MozyMarket`, `SettlementVault`, and `MozySettlement`, completes one-time wiring, enables the pinned market, and writes public addresses plus immutable bond/source-window policies to `artifacts/protocol/cc3-settlement.json`. Network writes are never retried automatically.

Verify the live deployment from a new process:

```bash
pnpm protocol:inspect
pnpm protocol:inspect --mandate 1
pnpm protocol:inspect --reservation 1
```

Before the first reservation, inspection reports `No reservations created for this protocol`. The reservation view leads with ID and status, identifies its parent acquisition and source market, then reports immutable terms, token decimals, delivery requirements, mandate quantities, all mandate budget buckets, isolated bond custody, reconciliation, and token solvency. An unknown ID reports `We couldn't find that reservation.` instead of presenting an empty object.

To recover without the local artifact, provide the four public protocol addresses and admin explicitly:

```bash
pnpm protocol:inspect --registry <address> --market <address> --vault <address> --settlement <address> --admin <address>
```

The current deployment and successful proof-to-payment run are recorded in
`artifacts/protocol/cc3-settlement.json` and
`artifacts/protocol/cc3-settlement-evidence.json`. Both contain public chain data only; signer
keys and credential-bearing RPC URLs remain sourced from `.env` and are never written to artifacts.

After creating and funding a mandate, creating a reservation, sending the direct TEST transfer,
and generating its proof, submit from an unrelated relayer:

```bash
pnpm protocol:settle --reservation <id> --proof .attestcoin/proofs/<source-tx>.json
pnpm protocol:inspect --reservation <id>
pnpm protocol:inspect --receipt <replay-identity>
pnpm protocol:evidence:check
```

The settlement command simulates the complete official verification and economic transition
before broadcasting once. It prints no proof blob and never retries a write automatically.

## Canonical mandate transaction path

After deployment, use the disposable buyer signer to:

1. call `createMandate` with market `1`, a nonzero delivery wallet, valid Limit or Range terms, a future expiry, and a reservation duration that fits before expiry;
2. read the returned mandate ID and `requiredFunding`;
3. approve that exact BTKT amount to `SettlementVault`;
4. call `fundMandate` once or in partial transactions whose cumulative value equals `requiredFunding`;
5. inspect the approval and funding transactions on the CC3 explorer;
6. confirm the mandate is `Open`, custody is at the vault, and the self-audit passes.

Operator tooling should map stable custom errors to the product copy in the mandate funding specification. In particular, never describe an underfunded mandate as open or reservable, and never describe mandate funding as Attestcoin settlement.

## Test-funds dispenser operations

The web app can allocate a small judge-friendly bundle from two dedicated testnet-only wallets. This convenience path is separate from Mozy delivery and settlement, deploys no Sepolia contract, and never mints BTKT. Configure the web runtime with:

```text
MOZY_FAUCET_ENABLED=true
MOZY_SEPOLIA_FAUCET_PRIVATE_KEY=<dedicated disposable Sepolia key>
MOZY_CREDITCOIN_FAUCET_PRIVATE_KEY=<dedicated disposable CC3 key>
UPSTASH_REDIS_REST_URL=<server-only REST endpoint>
UPSTASH_REDIS_REST_TOKEN=<server-only token>
MOZY_FAUCET_DAILY_BUNDLE_LIMIT=100
```

Never reuse the protocol admin, deployer, settlement relayer, or an account that has held real assets. Fund the Sepolia dispenser with ETH and at least 100 TEST per expected allocation. The public TEST contract supports `mint(uint256)`, so replenish that inventory from the dedicated dispenser account.

Fund the Creditcoin dispenser with tCTC and at least 100 BTKT per expected allocation. BTKT is not freely mintable: replenish it through the pinned official Hello Bridge burn, proof, and verified mint flow described in `docs/attestcoin.md`. The dispenser only transfers that pre-bridged inventory.

Before judging, open `/test-funds` with a fresh disposable wallet and confirm both token balances, both native gas checks, signature verification, explorer links, and the 24-hour repeat-claim protection. Monitor both dispenser addresses on their explorers and refill before either token balance falls below two bundles or native gas becomes low. Set `MOZY_FAUCET_ENABLED=false` to stop new allocations immediately; existing submitted transactions remain canonical and must not be resent automatically.

Rotate a dispenser key by disabling the feature, waiting for any submitted transactions to resolve, funding a new disposable account, replacing only that network's server secret, and re-enabling after a fresh readiness check. Never log, commit, or expose either key through a `NEXT_PUBLIC_` variable.

## Durable verification worker

Apply the committed private-schema migration with a direct or session Postgres connection:

```bash
DATABASE_MIGRATION_URL=<direct-or-session-url> pnpm db:migrate
```

The Vercel web runtime uses `DATABASE_URL` through the Supabase transaction pooler with prepared statements disabled. The persistent worker uses a direct connection when IPv6 is available or the session pooler on IPv4-only hosting. Keep the `mozy` schema out of the Supabase Data API. Configure `MOZY_RELAYER_PRIVATE_KEY` with a dedicated disposable CC3-only testnet account holding only enough tCTC for settlements; never reuse a buyer, solver, deployer, admin, or faucet key.

Start the restart-safe proof worker, event indexer, and reconciler in one process:

```bash
pnpm worker:dev
```

`GET /api/health` reports only coarse database, worker, indexer, and reconciler health. A degraded response does not change protocol state. Restarting the process is safe: expired 60-second job leases are reclaimable, source transfers are never resent, and known Creditcoin settlement hashes are reconciled before another submission.

For the permissionless-relay smoke path, fund a second disposable CC3 account and run the existing `protocol:settle` command with the same validated proof before the normal worker submits it. Confirm `ReservationSettled.relayer` changes while the canonical solver payout and bond return do not. Do not expose this as a product control.
