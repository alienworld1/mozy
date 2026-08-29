import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getExpiryReadiness } from "./reservation-recovery";

const base = {
  status: 0,
  chainTimestamp: 200n,
  deliveryDeadline: 100n,
  latestAttestedHeight: 19n,
  expiryEligibleHeight: 20n,
};

describe("reservation expiry readiness", () => {
  it("does not use source height before the canonical deadline", () => {
    assert.equal(
      getExpiryReadiness({ ...base, chainTimestamp: 99n, latestAttestedHeight: 20n }),
      "not_due",
    );
  });
  it("waits for the authenticated source window to close", () => {
    assert.equal(getExpiryReadiness(base), "waiting_source_closure");
  });
  it("becomes eligible only when both gates are met", () => {
    assert.equal(
      getExpiryReadiness({ ...base, latestAttestedHeight: 20n }),
      "eligible",
    );
  });
  it("never exposes an action when ChainInfo is unavailable or resolved", () => {
    assert.equal(
      getExpiryReadiness({ ...base, latestAttestedHeight: null }),
      "unavailable",
    );
    assert.equal(getExpiryReadiness({ ...base, status: 1 }), "resolved");
  });
});
