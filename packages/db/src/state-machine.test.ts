import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canTransition, retryDelayMs } from "./state-machine";

describe("proof job state machine", () => {
  it("allows only forward or explicit recovery transitions", () => {
    assert.equal(
      canTransition("DETECTED", "WAITING_SOURCE_CONFIRMATION"),
      true,
    );
    assert.equal(canTransition("PROOF_READY", "DETECTED"), false);
    assert.equal(canTransition("CONFIRMED", "RETRYABLE"), false);
  });
  it("caps retry delay at fifteen minutes with bounded jitter", () => {
    assert.equal(retryDelayMs(0, 0), 15_000);
    assert.equal(retryDelayMs(20, 1), 900_000);
  });
});
