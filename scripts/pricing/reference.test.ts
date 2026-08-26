import assert from "node:assert/strict";
import test from "node:test";
import { pricingFixtures } from "./fixtures.js";
import { referenceQuote } from "./reference.js";

for (const fixture of pricingFixtures) {
  test(fixture.name, () => {
    assert.equal(referenceQuote(fixture.input), fixture.expected);
  });
}

test("equal Range endpoints match Limit across valid intervals", () => {
  for (let target = 1n; target <= 40n; target++) {
    for (let start = 0n; start < target; start++) {
      const quantity = target - start;
      const common = { target, foreignTokenDecimals: 0, startPrice: 13n, endPrice: 13n, startPosition: start, quantity };
      assert.equal(referenceQuote({ mode: "range", ...common }), referenceQuote({ mode: "limit", ...common }));
    }
  }
});

test("partition payouts never exceed the full-target payout", () => {
  const common = { mode: "range" as const, target: 97n, foreignTokenDecimals: 0, startPrice: 101n, endPrice: 7n };
  const whole = referenceQuote({ ...common, startPosition: 0n, quantity: 97n });
  let partitions = 0n;
  for (let start = 0n; start < 97n; start++) {
    partitions += referenceQuote({ ...common, startPosition: start, quantity: 1n });
  }
  assert.ok(partitions <= whole);
});

test("invalid and zero-payout intervals are rejected", () => {
  assert.throws(() => referenceQuote({ mode: "range", target: 10n, foreignTokenDecimals: 18, startPrice: 1n, endPrice: 1n, startPosition: 0n, quantity: 1n }));
  assert.throws(() => referenceQuote({ mode: "limit", target: 10n, foreignTokenDecimals: 0, startPrice: 1n, endPrice: 2n, startPosition: 0n, quantity: 1n }));
  assert.throws(() => referenceQuote({ mode: "range", target: 10n, foreignTokenDecimals: 0, startPrice: 1n, endPrice: 2n, startPosition: 9n, quantity: 2n }));
});
