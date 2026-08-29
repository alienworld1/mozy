import assert from "node:assert/strict";
import { describe, it } from "node:test";
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

describe("public terminal reason mapping", () => {
  const cases = [
    ["The source transaction was included but did not succeed.", "source_transaction_failed"],
    ["Delivery did not call the approved token contract directly.", "wrong_token"],
    ["Source transaction sender does not match the expected solver address.", "wrong_sender"],
    ["Transfer recipient does not match the expected delivery wallet.", "wrong_recipient"],
    ["Transferred amount is below the required delivery amount.", "underdelivery"],
    ["Multiple qualifying Transfer logs make this delivery ambiguous.", "ambiguous_or_nonstandard_transfer"],
    ["source_height_outside_window", "invalid_delivery_timing"],
    ["ReceiptAlreadyConsumed", "receipt_already_consumed"],
    ["reservation_inactive", "reservation_no_longer_active"],
  ] as const;

  for (const [message, reasonClass] of cases) {
    it(`maps ${reasonClass}`, () => {
      const semanticMessages = new Set([
        "source_transaction_failed",
        "wrong_token",
        "wrong_sender",
        "wrong_recipient",
        "underdelivery",
        "ambiguous_or_nonstandard_transfer",
      ]);
      const error = semanticMessages.has(reasonClass)
        ? new AttestcoinError(
            "Comparing receipt semantics",
            "semantic_mismatch",
            message,
            "Register a correct replacement.",
          )
        : new Error(message);
      const classified = classifyJobError(error);
      assert.equal(classified.kind, "terminal");
      assert.equal(classified.errorClass, reasonClass);
      assert.match(classified.safeDetail, /Delivery/);
    });
  }
});
