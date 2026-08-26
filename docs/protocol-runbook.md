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

The local deployment uses an immutable 100 basis-point bond rate and a 10-token cap. After creating and fully funding an open mandate through the Module 2 path:

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
```

The deployer must have tCTC and BTKT. Build and deploy:

```bash
pnpm protocol:build
pnpm protocol:deploy
```

The command confirms chain ID `102031`, live BTKT code and decimals, config version, signer funding, and the nonzero policy owner before mutation. It waits for each receipt and prints each transaction hash and explorer link. It deploys `MarketRegistry`, `MozyMarket`, and `SettlementVault`, completes one-time wiring, enables the pinned market, and writes public data plus the immutable bond policy to `artifacts/protocol/cc3-module3.json`. The existing Module 2 artifact remains historical evidence. Network writes are never retried automatically.

Verify the live deployment from a new process:

```bash
pnpm protocol:inspect
pnpm protocol:inspect -- --mandate 1
pnpm protocol:inspect -- --reservation 1
```

Before the first reservation, inspection reports `No reservations created for this protocol`. The reservation view leads with ID and status, then reports immutable terms, delivery requirements, mandate quantities, all mandate budget buckets, isolated bond custody, reconciliation, and token solvency.

To recover without the local artifact, provide the three public addresses and admin explicitly:

```bash
pnpm protocol:inspect -- --registry <address> --market <address> --vault <address> --admin <address>
```

## Canonical mandate transaction path

After deployment, use the disposable buyer signer to:

1. call `createMandate` with market `1`, a nonzero delivery wallet, valid Limit or Range terms, a future expiry, and a reservation duration that fits before expiry;
2. read the returned mandate ID and `requiredFunding`;
3. approve that exact BTKT amount to `SettlementVault`;
4. call `fundMandate` once or in partial transactions whose cumulative value equals `requiredFunding`;
5. inspect the approval and funding transactions on the CC3 explorer;
6. confirm the mandate is `Open`, custody is at the vault, and the self-audit passes.

Operator tooling should map stable custom errors to the product copy in the Module 2 spec. In particular, never describe an underfunded mandate as open or reservable, and never describe Module 2 as Attestcoin settlement.
