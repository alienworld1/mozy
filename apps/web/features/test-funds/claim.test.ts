import assert from "node:assert/strict";
import test from "node:test";
import type { Address } from "viem";

process.env.NEXT_PUBLIC_CREDITCOIN_RPC_URL = "https://rpc.cc3-testnet.creditcoin.network";
process.env.NEXT_PUBLIC_FOREIGN_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

const claimModule = () => import("./claim");

const address = "0x1111111111111111111111111111111111111111" as Address;
const unsigned = {
  address,
  origin: "https://mozy.example",
  issuedAt: "2026-08-28T10:00:00.000Z",
  expiresAt: "2026-08-28T10:05:00.000Z",
  configVersion: "cc3-test",
};

test("claim statement binds the wallet, origin, release, and lifetime", async () => {
  const { buildTestFundsClaimStatement } = await claimModule();
  const statement = buildTestFundsClaimStatement(unsigned);
  assert.match(statement, new RegExp(address));
  assert.match(statement, /https:\/\/mozy\.example/);
  assert.match(statement, /cc3-test/);
  assert.match(statement, /does not authorize a transfer from your wallet/);
});

test("claim schema rejects malformed addresses and signatures", async () => {
  const { testFundsClaimSchema } = await claimModule();
  assert.equal(testFundsClaimSchema.safeParse({ ...unsigned, signature: `0x${"a".repeat(130)}` }).success, true);
  assert.equal(testFundsClaimSchema.safeParse({ ...unsigned, address: "not-an-address", signature: "0x12" }).success, false);
});

test("top-up deficit never overfunds an already-ready balance", async () => {
  const { topUpDeficit } = await claimModule();
  assert.equal(topUpDeficit(40n, 100n), 60n);
  assert.equal(topUpDeficit(100n, 100n), 0n);
  assert.equal(topUpDeficit(125n, 100n), 0n);
});

test("readiness requires both token targets and gas on both networks", async () => {
  const { getTestFundsReadiness } = await claimModule();
  const unit = 10n ** 18n;
  assert.deepEqual(getTestFundsReadiness({ sepoliaGas: 1n, test: 100n * unit, creditcoinGas: 1n, btkt: 100n * unit }), {
    testReady: true,
    btktReady: true,
    gasReady: true,
    ready: true,
  });
  assert.equal(getTestFundsReadiness({ sepoliaGas: 0n, test: 100n * unit, creditcoinGas: 1n, btkt: 100n * unit }).ready, false);
  assert.equal(getTestFundsReadiness({ sepoliaGas: 1n, test: 99n * unit, creditcoinGas: 1n, btkt: 100n * unit }).ready, false);
});
