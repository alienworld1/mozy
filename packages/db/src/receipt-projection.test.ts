import assert from "node:assert/strict";
import test from "node:test";
import { buildSettlementReceiptProjection } from "./repositories";

test("settlement receipt projection is deterministic from event and candidate facts", () => {
  const input = {
    configVersion: "release-1",
    candidate: {
      id: 7n,
      transactionHash: `0x${"a".repeat(64)}`,
    },
    event: {
      transactionHash: `0x${"b".repeat(64)}`,
      blockNumber: 80n,
      payload: {
        reservationId: "4",
        mandateId: "3",
        replayIdentity: `0x${"c".repeat(64)}`,
        sourceChainKey: "1",
        blockHeight: "50",
        transactionIndex: "2",
        transferLogIndex: "6",
        token: "0x1111111111111111111111111111111111111111",
        solver: "0x2222222222222222222222222222222222222222",
        recipient: "0x3333333333333333333333333333333333333333",
        relayer: "0x4444444444444444444444444444444444444444",
        deliveredAmount: "110",
        creditedAmount: "100",
        lockedPayout: "250",
        returnedBond: "25",
      },
    },
  } as const;
  const first = buildSettlementReceiptProjection(input);
  const second = buildSettlementReceiptProjection(input);
  assert.deepEqual(first, second);
  assert.equal(first.deliveredAmount, "110");
  assert.equal(first.creditedAmount, "100");
  assert.equal(first.foreignTxHash, input.candidate.transactionHash);
  assert.equal(first.creditcoinSettlementTxHash, input.event.transactionHash);
});

