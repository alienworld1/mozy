import assert from "node:assert/strict";
import test from "node:test";
import settlementEvidence from "../../../../artifacts/protocol/cc3-settlement-evidence.json";
import {
  buildExplorerUrl,
  formatEvidenceAmount,
  parseLandingEvidence,
} from "./landing-evidence";

test("parses the committed settled evidence", () => {
  const evidence = parseLandingEvidence(settlementEvidence);

  assert.equal(evidence.deliveredAmount, "0.001");
  assert.equal(evidence.payoutAmount, "0.001");
  assert.equal(evidence.semanticChecks.at(-1)?.result, "Settled");
  assert.match(evidence.foreignExplorerUrl, /sepolia\.etherscan\.io\/tx\//);
  assert.match(evidence.settlementExplorerUrl, /creditcoin-testnet\.blockscout\.com\/tx\//);
});

test("rejects evidence without a settled reservation", () => {
  assert.throws(() =>
    parseLandingEvidence({
      ...settlementEvidence,
      semanticChecks: {
        ...settlementEvidence.semanticChecks,
        reservationState: "pending",
      },
    }),
  );
});

test("formats exact token amounts and explorer links", () => {
  assert.equal(formatEvidenceAmount("1000000000000000", 18), "0.001");
  assert.equal(formatEvidenceAmount("1000000000000000000", 18), "1");
  assert.equal(
    buildExplorerUrl("https://example.com/", settlementEvidence.foreignTransaction),
    `https://example.com/tx/${settlementEvidence.foreignTransaction}`,
  );
});
