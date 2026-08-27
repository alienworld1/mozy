import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FillQuote, InstrumentModel, Reservation } from "../types";
import { buildInstrumentChartData, normalizeQuantity } from "./instrument-chart-data";

const baseModel: InstrumentModel = {
  targetQuantity: 100n,
  settledQuantity: 25n,
  reservedQuantity: 15n,
  openQuantity: 60n,
  currentPosition: 40n,
  pricingMode: "Range",
  startPrice: 2n,
  endPrice: 5n,
  snapshotBlock: 99n,
};

function reservation(id: bigint, quantity: bigint): Reservation {
  return {
    id,
    mandateId: 7n,
    solver: "0x0000000000000000000000000000000000000001",
    quantity,
    lockedPayout: quantity * 2n,
    bondAmount: 0n,
    createdAt: id,
    deliveryDeadline: 2_000_000_000n,
    sourceStartHeight: 0n,
    sourceEndHeight: 0n,
    expiryEligibleHeight: 0n,
    status: 0,
  };
}

describe("instrument chart normalization", () => {
  it("bounds display coordinates without converting economic values to floating point", () => {
    assert.equal(normalizeQuantity(0n, 10n), 0);
    assert.equal(normalizeQuantity(1n, 3n), 33.3333);
    assert.equal(normalizeQuantity(10n ** 36n, 10n ** 36n), 100);
    assert.equal(Number.isFinite(normalizeQuantity(10n ** 35n, 10n ** 36n)), true);
  });

  it("represents Limit and both Range directions", () => {
    const limit = buildInstrumentChartData({ ...baseModel, pricingMode: "Limit", startPrice: 5n, endPrice: 5n }, []);
    const increasing = buildInstrumentChartData(baseModel, []);
    const decreasing = buildInstrumentChartData({ ...baseModel, startPrice: 5n, endPrice: 2n }, []);
    const equalRange = buildInstrumentChartData({ ...baseModel, startPrice: 3n, endPrice: 3n }, []);

    assert.deepEqual(limit.pricePoints.map((point) => point.price), [50, 50]);
    assert.equal(increasing.pricePoints[0].price < increasing.pricePoints[1].price, true);
    assert.equal(decreasing.pricePoints[0].price > decreasing.pricePoints[1].price, true);
    assert.deepEqual(equalRange.pricePoints.map((point) => point.price), [50, 50]);
  });

  it("builds aggregate and reconciled reservation allocations", () => {
    const aggregate = buildInstrumentChartData(baseModel, []);
    const reconciled = buildInstrumentChartData(baseModel, [reservation(10n, 10n), reservation(9n, 5n)]);

    assert.deepEqual(aggregate.allocationSegments.map(({ kind, label, value }) => ({ kind, label, value })), [
      { kind: "settled", label: "SETTLED", value: 25 },
      { kind: "reserved", label: "RESERVED", value: 15 },
      { kind: "open", label: "OPEN", value: 60 },
    ]);
    assert.deepEqual(reconciled.allocationSegments.map(({ label, value }) => ({ label, value })), [
      { label: "SETTLED", value: 25 },
      { label: "R9", value: 5 },
      { label: "R10", value: 10 },
      { label: "OPEN", value: 60 },
    ]);
  });

  it("omits zero-width regions and preserves fully open and filled structures", () => {
    const open = buildInstrumentChartData({
      ...baseModel,
      settledQuantity: 0n,
      reservedQuantity: 0n,
      openQuantity: 100n,
      currentPosition: 0n,
    }, []);
    const filled = buildInstrumentChartData({
      ...baseModel,
      settledQuantity: 100n,
      reservedQuantity: 0n,
      openQuantity: 0n,
      currentPosition: 100n,
    }, []);

    assert.deepEqual(open.allocationSegments.map((segment) => segment.kind), ["open"]);
    assert.deepEqual(filled.allocationSegments.map((segment) => segment.kind), ["settled"]);
  });

  it("normalizes a canonical measured interval", () => {
    const quote: FillQuote = {
      quantity: 10n,
      startPosition: 40n,
      endPosition: 50n,
      payout: 25n,
      quotedAtBlock: 100n,
    };
    const chart = buildInstrumentChartData(baseModel, [], quote);

    assert.deepEqual(chart.measurement, { start: 40, end: 50 });
    assert.equal(chart.currentPosition, 40);
  });
});
