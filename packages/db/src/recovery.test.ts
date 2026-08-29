import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { candidateNextAction, publicReason } from "./recovery";

describe("public recovery reasons", () => {
  const cases = [
    ["The source transaction was included but did not succeed.", "source_transaction_failed"],
    ["Delivery did not call the approved token contract directly.", "wrong_token"],
    ["Source transaction sender does not match the expected solver address.", "wrong_sender"],
    ["Transfer recipient does not match the expected delivery wallet.", "wrong_recipient"],
    ["Transferred amount is below the required delivery amount.", "underdelivery"],
    ["Multiple qualifying Transfer logs make this delivery ambiguous.", "ambiguous_or_nonstandard_transfer"],
    ["source_height_outside_window", "invalid_delivery_timing"],
    ["ReceiptAlreadyConsumed", "receipt_already_consumed"],
  ] as const;

  for (const [input, expected] of cases)
    it(`maps ${expected}`, () => {
      const result = publicReason(input);
      assert.equal(result.reasonClass, expected);
      assert.equal(result.message.includes(input), false);
    });
});

describe("candidate recovery action", () => {
  it("allows replacement only after terminal rejection on an active reservation", () => {
    assert.equal(candidateNextAction("Active", "TERMINAL_REJECTED"), "replace_candidate");
    assert.equal(candidateNextAction("Expired", "TERMINAL_REJECTED"), "none");
  });
  it("blocks replacement while settlement is submitted or uncertain", () => {
    assert.equal(candidateNextAction("Active", "SUBMITTING"), "inspect_settlement");
    assert.equal(candidateNextAction("Active", "RETRYABLE", "SUBMITTING"), "inspect_settlement");
  });
  it("distinguishes infrastructure retry from normal waiting", () => {
    assert.equal(candidateNextAction("Active", "RETRYABLE", "WAITING_ATTESTATION"), "automatic_retry");
    assert.equal(candidateNextAction("Active", "WAITING_ATTESTATION"), "wait");
  });
});
