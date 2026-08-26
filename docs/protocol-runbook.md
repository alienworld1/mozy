# Protocol runbook

## Local verification

Install root dependencies, then run:

```bash
pnpm protocol:build
pnpm pricing:test
pnpm protocol:test
pnpm attestcoin:typecheck
```

The Foundry suite covers Limit and Range fixtures, fuzzed equal-endpoint pricing, lifecycle authorization, partial and exact funding, overfunding rollback, cancellation, expiry, partial/full refund, permissionless close, mandate isolation, direct-transfer isolation, short-transfer rejection, funding/refund reentrancy, and future-only lock/unlock/spend accounting.

For a persistent local chain, start Anvil in one terminal. Put one Anvil private key in `MOZY_LOCAL_PRIVATE_KEY`, then deploy with:

```bash
pnpm protocol:deploy:local -- --rpc-url http://127.0.0.1:8545
```

The Forge output lists the local token, registry, market, and vault addresses. From a fresh shell, use `cast call` against those addresses to confirm `nextMandateId()`, `getMarket(uint256)`, `getMandate(uint256)`, `getAccount(uint256)`, and `auditMandate(uint256)`. Use `cast send` from the local buyer key to approve the vault, create a mandate, fund it in two transactions, pause/resume, cancel, refund in two transactions, and close. Every write should be inspected by transaction hash before another write is submitted.

The focused automated happy path is also available with:

```bash
forge test --match-test testHappyPathFundingLifecycleAndIsolation -vvvv
```

## Creditcoin deployment

Module 1 receipt verification has been confirmed separately. Its evidence command remains available as a read-only operational check:

```bash
pnpm attestcoin:evidence:check
```

The Module 2 deployment command does not use the local evidence-manifest status as a release gate. It independently validates the pinned public configuration and all live Creditcoin deployment requirements before mutation.

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

The command confirms chain ID `102031`, live BTKT code and decimals, config version, signer funding, and the nonzero policy owner before mutation. It waits for each receipt and prints each transaction hash and explorer link. It deploys `MarketRegistry`, `MozyMarket`, and `SettlementVault`, completes one-time wiring, enables the pinned market, and writes public data to `artifacts/protocol/cc3.json`. Network writes are never retried automatically.

Verify the live deployment from a new process:

```bash
pnpm protocol:inspect
pnpm protocol:inspect -- --mandate 1
```

Before the first mandate, inspection reports `No mandates created`. The mandate view leads with ID, status, target, required funding, and funded/free/reserved/spent/refunded BTKT base units, followed by quantity and budget reconciliation.

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
