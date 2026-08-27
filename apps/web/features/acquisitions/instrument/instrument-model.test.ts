import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Mandate } from "../types";
import { buildInstrumentModel, validateMeasurement } from "./instrument-model";

const mandate: Mandate = {
  id: 7n,
  buyer: "0x0000000000000000000000000000000000000001",
  marketId: 1n,
  deliveryWallet: "0x0000000000000000000000000000000000000002",
  targetAmount: 100n,
  acquiredAmount: 25n,
  reservedAmount: 15n,
  pricingMode: 1,
  startPrice: 2n,
  endPrice: 5n,
  requiredFunding: 500n,
  mandateExpiry: 2_000_000_000n,
  reservationDuration: 3_600n,
  status: 1,
  createdAt: 1n,
};

describe("instrument model", () => {
  it("derives exact cumulative quantities", () => {
    assert.deepEqual(buildInstrumentModel(mandate, 99n), {
      targetQuantity: 100n,
      settledQuantity: 25n,
      reservedQuantity: 15n,
      openQuantity: 60n,
      currentPosition: 40n,
      pricingMode: "Range",
      startPrice: 2n,
      endPrice: 5n,
      snapshotBlock: 99n,
    });
  });

  it("rejects unverifiable terms and accounting", () => {
    assert.equal(buildInstrumentModel({ ...mandate, targetAmount: 0n }, 1n), undefined);
    assert.equal(buildInstrumentModel({ ...mandate, acquiredAmount: 90n, reservedAmount: 20n }, 1n), undefined);
    assert.equal(buildInstrumentModel({ ...mandate, pricingMode: 2 }, 1n), undefined);
  });
});

describe("fill measurement validation", () => {
  it("accepts an exact decimal within the open quantity", () => {
    assert.deepEqual(validateMeasurement("1.25", 18, "TEST", 2n * 10n ** 18n, "2"), {
      status: "valid",
      quantity: 1_250_000_000_000_000_000n,
    });
  });

  it("distinguishes neutral, malformed, precision, zero, and above-open states", () => {
    assert.deepEqual(validateMeasurement("", 18, "TEST", 1n, "0.000000000000000001"), { status: "empty" });
    assert.deepEqual(validateMeasurement("1e2", 18, "TEST", 1_000n, "0.000000000000001"), { status: "invalid", message: "Enter a valid TEST amount." });
    assert.deepEqual(validateMeasurement("1.0000000000000000001", 18, "TEST", 10n ** 20n, "100"), { status: "invalid", message: "TEST supports up to 18 decimal places." });
    assert.deepEqual(validateMeasurement("0", 18, "TEST", 10n, "0.00000000000000001"), { status: "invalid", message: "Enter an amount greater than zero." });
    assert.deepEqual(validateMeasurement("2", 0, "TEST", 1n, "1"), { status: "invalid", message: "Enter no more than 1 TEST." });
  });
});
