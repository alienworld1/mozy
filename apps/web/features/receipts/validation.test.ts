import assert from "node:assert/strict";
import test from "node:test";
import { isReservationId, isStandardTransferEvidence } from "./validation";

const token = "0x1111111111111111111111111111111111111111";
const solver = "0x2222222222222222222222222222222222222222";
const recipient = "0x3333333333333333333333333333333333333333";

test("reservation IDs are positive uint256 decimal values", () => {
  assert.equal(isReservationId("1"), true);
  assert.equal(isReservationId(((1n << 256n) - 1n).toString()), true);
  assert.equal(isReservationId("0"), false);
  assert.equal(isReservationId("1.2"), false);
  assert.equal(isReservationId((1n << 256n).toString()), false);
});

test("standard transfer copy requires every authenticated transfer fact", () => {
  const evidence = {
    receiptStatus: 1,
    semanticStatus: "accepted",
    transactionTo: token,
    transferFrom: solver,
    transferTo: recipient,
    transferAmount: "100",
    transferLogIndex: 4n,
    observedBlockNumber: 90n,
    transactionIndex: 2n,
    token,
    solver,
    recipient,
    deliveredAmount: "100",
    expectedTransferLogIndex: 4n,
    blockHeight: 90n,
    expectedTransactionIndex: 2n,
  };
  assert.equal(isStandardTransferEvidence(evidence), true);
  assert.equal(isStandardTransferEvidence({ ...evidence, transactionTo: recipient }), false);
  assert.equal(isStandardTransferEvidence({ ...evidence, transferAmount: "99" }), false);
  assert.equal(isStandardTransferEvidence({ ...evidence, semanticStatus: "pending" }), false);
});

