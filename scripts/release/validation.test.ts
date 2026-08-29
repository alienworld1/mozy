import assert from "node:assert/strict";
import test from "node:test";
import { validateSubmissionRelease } from "./validation.js";

const address = (digit: string) => `0x${digit.repeat(40)}`;
const hash = (digit: string) => `0x${digit.repeat(64)}`;
const environment = {
  configVersion: "release-1",
  creditcoin: { chainId: 102031, explorerUrl: "https://cc3.example.org" },
  foreign: { chainId: 11155111, explorerUrl: "https://sepolia.example.org" },
  deliveryToken: { address: address("1") },
  settlementToken: { address: address("2") },
  attestcoin: {
    verifierAddress: address("3"),
    chainInfoAddress: address("4"),
    decoderAddress: address("5"),
  },
};
const contracts = {
  market: address("6"), verifier: address("3"), chainInfo: address("4"), decoder: address("5"),
};
const deployment = { environmentConfigVersion: "release-1", chainId: 102031, marketId: "1", contracts };

test("fails closed for stale evidence and absent public URLs", () => {
  const failures = validateSubmissionRelease({
    root: process.cwd(),
    environment,
    deployment,
    manifest: {
      schemaVersion: "1",
      releaseConfigVersion: "release-1",
      deploymentArtifact: "artifacts/protocol/cc3-settlement.json",
      currentDeployment: {
        chainId: 102031,
        marketId: "1",
        contracts,
        deliveryToken: address("1"),
        settlementToken: address("2"),
      },
      successfulPath: null,
      rejectedPaths: [],
      checks: { offline: "not-run", liveEvidence: "not-run", checkedAt: null },
      knownLimitations: "docs/security.md",
    },
    settlementEvidence: { deploymentArtifact: "artifacts/protocol/old.json", contracts },
  });
  assert.ok(failures.includes("Submission evidence does not match the current release deployment."));
  assert.ok(failures.includes("Add the deployed app URL before marking the submission ready. (deployedAppUrl)"));
  assert.ok(failures.includes("Live evidence was not checked."));
});

test("accepts a consistent finalized manifest", () => {
  const foreignTransaction = hash("a");
  const settlementTransaction = hash("b");
  const failures = validateSubmissionRelease({
    root: process.cwd(),
    environment,
    deployment,
    manifest: {
      schemaVersion: "1",
      releaseConfigVersion: "release-1",
      deploymentArtifact: "artifacts/protocol/cc3-settlement.json",
      deployedAppUrl: "https://mozy.example.org",
      repositoryUrl: "https://github.com/example/mozy",
      whitepaperOrDeckUrl: "https://cdn.example.org/mozy.pdf",
      videoUrl: "https://video.example.org/mozy",
      currentDeployment: { chainId: 102031, marketId: "1", contracts, deliveryToken: address("1"), settlementToken: address("2") },
      successfulPath: {
        evidencePath: "docs/security.md",
        foreignTransaction,
        foreignExplorerUrl: `https://sepolia.example.org/tx/${foreignTransaction}`,
        settlementTransaction,
        settlementExplorerUrl: `https://cc3.example.org/tx/${settlementTransaction}`,
      },
      rejectedPaths: [
        { kind: "wrong-token", evidencePath: "docs/security.md" },
        { kind: "wrong-sender-or-recipient", evidencePath: "docs/security.md" },
        { kind: "replay", evidencePath: "docs/security.md" },
      ],
      checks: { offline: "pass", liveEvidence: "pass", checkedAt: "2026-08-29T00:00:00.000Z" },
      knownLimitations: "docs/security.md",
    },
    settlementEvidence: { deploymentArtifact: "artifacts/protocol/cc3-settlement.json", contracts },
  });
  assert.deepEqual(failures, []);
});
