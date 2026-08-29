import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { needsCanonicalReservationRefresh } from "./verification";

describe("verification canonical refresh", () => {
  it("refreshes an active workspace when verification observes settlement", () => {
    assert.equal(needsCanonicalReservationRefresh("Settled", 0), true);
  });

  it("does not refresh once the workspace direct read is settled", () => {
    assert.equal(needsCanonicalReservationRefresh("Settled", 2), false);
  });

  it("does not treat an indexed active state as settlement", () => {
    assert.equal(needsCanonicalReservationRefresh("Active", 0), false);
  });
});
