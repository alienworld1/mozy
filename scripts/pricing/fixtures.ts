import type { QuoteInput } from "./reference.js";

export interface PricingFixture {
  name: string;
  input: QuoteInput;
  expected: bigint;
}

const unit = 10n ** 18n;

export const pricingFixtures: readonly PricingFixture[] = [
  {
    name: "limit one base unit",
    input: { mode: "limit", target: 3n * unit, foreignTokenDecimals: 18, startPrice: 2n * unit, endPrice: 2n * unit, startPosition: 0n, quantity: 1n },
    expected: 2n,
  },
  {
    name: "limit full target",
    input: { mode: "limit", target: 3n * unit, foreignTokenDecimals: 18, startPrice: 2n * unit, endPrice: 2n * unit, startPosition: 0n, quantity: 3n * unit },
    expected: 6n * unit,
  },
  {
    name: "increasing range full target",
    input: { mode: "range", target: 4n * unit, foreignTokenDecimals: 18, startPrice: 2n * unit, endPrice: 6n * unit, startPosition: 0n, quantity: 4n * unit },
    expected: 16n * unit,
  },
  {
    name: "increasing range first quarter",
    input: { mode: "range", target: 4n * unit, foreignTokenDecimals: 18, startPrice: 2n * unit, endPrice: 6n * unit, startPosition: 0n, quantity: unit },
    expected: 5n * unit / 2n,
  },
  {
    name: "increasing range last quarter",
    input: { mode: "range", target: 4n * unit, foreignTokenDecimals: 18, startPrice: 2n * unit, endPrice: 6n * unit, startPosition: 3n * unit, quantity: unit },
    expected: 11n * unit / 2n,
  },
  {
    name: "increasing range middle half",
    input: { mode: "range", target: 4n * unit, foreignTokenDecimals: 18, startPrice: 2n * unit, endPrice: 6n * unit, startPosition: unit, quantity: 2n * unit },
    expected: 8n * unit,
  },
  {
    name: "decreasing range first quarter",
    input: { mode: "range", target: 4n * unit, foreignTokenDecimals: 18, startPrice: 6n * unit, endPrice: 2n * unit, startPosition: 0n, quantity: unit },
    expected: 11n * unit / 2n,
  },
  {
    name: "decreasing range last quarter",
    input: { mode: "range", target: 4n * unit, foreignTokenDecimals: 18, startPrice: 6n * unit, endPrice: 2n * unit, startPosition: 3n * unit, quantity: unit },
    expected: 5n * unit / 2n,
  },
  {
    name: "decreasing range full target",
    input: { mode: "range", target: 4n * unit, foreignTokenDecimals: 18, startPrice: 6n * unit, endPrice: 2n * unit, startPosition: 0n, quantity: 4n * unit },
    expected: 16n * unit,
  },
  {
    name: "equal range endpoints",
    input: { mode: "range", target: 11n, foreignTokenDecimals: 0, startPrice: 7n, endPrice: 7n, startPosition: 3n, quantity: 5n },
    expected: 35n,
  },
  {
    name: "odd numerator rounds once",
    input: { mode: "range", target: 3n, foreignTokenDecimals: 0, startPrice: 2n, endPrice: 5n, startPosition: 1n, quantity: 1n },
    expected: 3n,
  },
  {
    name: "documented maximum",
    input: { mode: "range", target: 10n ** 24n, foreignTokenDecimals: 18, startPrice: 10n ** 24n, endPrice: 1n, startPosition: 0n, quantity: 10n ** 24n },
    expected: 500000000000000000000000500000n,
  },
] as const;
