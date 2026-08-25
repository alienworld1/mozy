import assert from "node:assert/strict";
import test from "node:test";
import { requirePositiveAmount, requireTransactionHash } from "./validation.js";

test("accepts positive base-unit integers without number conversion", () => {
  assert.equal(requirePositiveAmount("900719925474099312345"), 900719925474099312345n);
});

test("rejects zero, signed, fractional, and malformed amounts", () => {
  for (const amount of ["0", "-1", "+1", "1.5", "1e18", ""]) {
    assert.throws(() => requirePositiveAmount(amount));
  }
});

test("requires a full 32-byte transaction hash", () => {
  const hash = `0x${"ab".repeat(32)}`;
  assert.equal(requireTransactionHash(hash), hash);
  assert.throws(() => requireTransactionHash(`0x${"ab".repeat(31)}`));
});
