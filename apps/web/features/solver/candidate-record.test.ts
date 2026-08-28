import assert from "node:assert/strict";
import test from "node:test";
import type { Address, Hash } from "viem";
import {
  buildRegistrationStatement,
  candidateStorageKey,
  mergeCandidateRecord,
  parseCandidateRecords,
  type CandidateRecord,
} from "./candidate-record";

const solver = "0x1111111111111111111111111111111111111111" as Address;
const firstHash = `0x${"a".repeat(64)}` as Hash;
const secondHash = `0x${"b".repeat(64)}` as Hash;
const base: CandidateRecord = {
  configVersion: "cc3",
  reservationId: "7",
  solver,
  foreignChainId: 11155111,
  transactionHash: firstHash,
  source: "external",
  localState: "registered",
  submittedAt: "2026-08-27T10:00:00.000Z",
};

test("candidate merge is idempotent and retains replacement history", () => {
  assert.equal(mergeCandidateRecord([base], base).length, 1);
  const records = mergeCandidateRecord([base], {
    ...base,
    transactionHash: secondHash,
    replacesHash: firstHash,
  });
  assert.equal(records[0].localState, "replaced");
  assert.equal(records[1].transactionHash, secondHash);
});

test("candidate parsing discards corrupt storage", () => {
  assert.deepEqual(parseCandidateRecords("not-json"), []);
  assert.deepEqual(parseCandidateRecords(JSON.stringify([{ nope: true }])), []);
});

test("statement and storage key bind reservation, solver, and hash", () => {
  const unsigned = {
    configVersion: "cc3",
    reservationId: "7",
    solver,
    foreignChainId: 11155111,
    transactionHash: firstHash,
    source: "external" as const,
    issuedAt: "2026-08-27T10:00:00.000Z",
    expiresAt: "2026-08-27T10:05:00.000Z",
    origin: "http://localhost:3000",
  };
  assert.match(buildRegistrationStatement(unsigned), /Reservation: R7/);
  assert.match(buildRegistrationStatement(unsigned), new RegExp(firstHash));
  assert.match(candidateStorageKey("cc3", "7", solver), /cc3:7:/);
});
