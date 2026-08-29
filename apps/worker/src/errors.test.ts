import assert from "node:assert/strict";
import { it } from "node:test";
import { AttestcoinError } from "../../../scripts/attestcoin/errors.js";
import { classifyJobError } from "./errors.js";

it("keeps proof infrastructure failures retryable without leaking detail", () => {
  const classified = classifyJobError(
    new AttestcoinError(
      "Proof",
      "proof_service_error",
      "private provider body",
      "retry",
      2,
    ),
  );
  assert.equal(classified.kind, "retryable");
  assert.equal(classified.safeDetail.includes("private provider body"), false);
});
