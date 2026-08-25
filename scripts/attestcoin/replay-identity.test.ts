import assert from "node:assert/strict";
import test from "node:test";
import { id } from "ethers";
import { TRANSFER_TOPIC } from "./constants.js";
import { deriveReplayIdentity } from "./replay-identity.js";

test("uses the canonical ERC-20 Transfer topic", () => {
  assert.equal(TRANSFER_TOPIC, id("Transfer(address,address,uint256)"));
});

test("derives a deterministic identity from chain key, height, and transaction index", () => {
  const first = deriveReplayIdentity(1n, 12_345_678n, 7n);
  const second = deriveReplayIdentity(1n, 12_345_678n, 7n);
  assert.equal(first, second);
  assert.notEqual(first, deriveReplayIdentity(1n, 12_345_678n, 8n));
  assert.notEqual(first, deriveReplayIdentity(3n, 12_345_678n, 7n));
});
