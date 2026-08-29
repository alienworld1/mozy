import { existsSync } from "node:fs";
import path from "node:path";

export type ReleaseEnvironment = {
  configVersion: string;
  creditcoin: { chainId: number; explorerUrl: string };
  foreign: { chainId: number; explorerUrl: string };
  deliveryToken: { address: string };
  settlementToken: { address: string };
  attestcoin: {
    verifierAddress: string;
    chainInfoAddress: string;
    decoderAddress: string;
  };
};

export type ReleaseDeployment = {
  environmentConfigVersion: string;
  chainId: number;
  marketId: string;
  contracts: Record<string, string>;
};

export type SubmissionManifest = {
  schemaVersion?: string;
  releaseConfigVersion?: string;
  deploymentArtifact?: string;
  deployedAppUrl?: string | null;
  repositoryUrl?: string | null;
  whitepaperOrDeckUrl?: string | null;
  videoUrl?: string | null;
  currentDeployment?: {
    chainId?: number;
    marketId?: string;
    contracts?: Record<string, string>;
    deliveryToken?: string;
    settlementToken?: string;
  };
  successfulPath?: {
    evidencePath?: string;
    foreignTransaction?: string;
    foreignExplorerUrl?: string;
    settlementTransaction?: string;
    settlementExplorerUrl?: string;
  } | null;
  rejectedPaths?: Array<{ kind?: string; evidencePath?: string }>;
  checks?: {
    offline?: string;
    liveEvidence?: string;
    checkedAt?: string | null;
  };
  knownLimitations?: string;
};

const hashPattern = /^0x[0-9a-fA-F]{64}$/;
const addressPattern = /^0x[0-9a-fA-F]{40}$/;

function sameAddress(left?: string, right?: string) {
  return !!left && !!right && addressPattern.test(left) && left.toLowerCase() === right.toLowerCase();
}

function validPublicUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname !== "localhost"
      && !url.hostname.endsWith(".localhost")
      && !url.hostname.includes("example.com")
      && !/[<>]/.test(value)
      && !/todo/i.test(value);
  } catch {
    return false;
  }
}

function expectedExplorerUrl(base: string, hash: string) {
  return `${base.replace(/\/$/, "")}/tx/${hash}`;
}

export function validateSubmissionRelease({
  root,
  environment,
  deployment,
  manifest,
  settlementEvidence,
}: {
  root: string;
  environment: ReleaseEnvironment;
  deployment: ReleaseDeployment;
  manifest: SubmissionManifest;
  settlementEvidence?: { deploymentArtifact?: string; contracts?: Record<string, string> };
}) {
  const failures: string[] = [];
  const fail = (message: string) => failures.push(message);

  if (manifest.schemaVersion !== "1") fail("Submission manifest schemaVersion must be 1.");
  if (manifest.releaseConfigVersion !== environment.configVersion) {
    fail("Submission evidence does not match the current release deployment.");
  }
  if (manifest.deploymentArtifact !== "artifacts/protocol/cc3-settlement.json") {
    fail("Submission evidence does not match the current release deployment.");
  }
  if (
    deployment.environmentConfigVersion !== environment.configVersion
    || deployment.chainId !== environment.creditcoin.chainId
    || manifest.currentDeployment?.chainId !== deployment.chainId
    || manifest.currentDeployment?.marketId !== deployment.marketId
  ) {
    fail("Submission evidence does not match the current release deployment.");
  }

  for (const [name, expected] of Object.entries(deployment.contracts)) {
    if (!sameAddress(manifest.currentDeployment?.contracts?.[name], expected)) {
      fail(`Submission manifest contract ${name} does not match the current deployment.`);
    }
  }
  for (const [name, expected] of [
    ["verifier", environment.attestcoin.verifierAddress],
    ["chainInfo", environment.attestcoin.chainInfoAddress],
    ["decoder", environment.attestcoin.decoderAddress],
  ] as const) {
    if (!sameAddress(deployment.contracts[name], expected)) {
      fail(`Current deployment ${name} does not match the pinned Attestcoin environment.`);
    }
  }
  if (!sameAddress(manifest.currentDeployment?.deliveryToken, environment.deliveryToken.address)) {
    fail("Submission delivery token does not match the pinned release token.");
  }
  if (!sameAddress(manifest.currentDeployment?.settlementToken, environment.settlementToken.address)) {
    fail("Submission settlement token does not match the pinned release token.");
  }

  for (const [field, value, message] of [
    ["deployedAppUrl", manifest.deployedAppUrl, "Add the deployed app URL before marking the submission ready."],
    ["repositoryUrl", manifest.repositoryUrl, "Add the public repository URL before marking the submission ready."],
    ["whitepaperOrDeckUrl", manifest.whitepaperOrDeckUrl, "Add the public whitepaper or deck URL before marking the submission ready."],
    ["videoUrl", manifest.videoUrl, "Add the public video URL before marking the submission ready."],
  ] as const) {
    if (!validPublicUrl(value)) fail(`${message} (${field})`);
  }

  const successfulPath = manifest.successfulPath;
  if (!successfulPath || settlementEvidence?.deploymentArtifact !== manifest.deploymentArtifact) {
    fail("Submission evidence does not match the current release deployment.");
  } else {
    for (const [field, hash, url, explorer] of [
      ["foreign", successfulPath.foreignTransaction, successfulPath.foreignExplorerUrl, environment.foreign.explorerUrl],
      ["settlement", successfulPath.settlementTransaction, successfulPath.settlementExplorerUrl, environment.creditcoin.explorerUrl],
    ] as const) {
      if (!hash || !hashPattern.test(hash) || url !== expectedExplorerUrl(explorer, hash)) {
        fail(`The ${field} transaction hash or explorer URL is invalid.`);
      }
    }
    if (!successfulPath.evidencePath || !existsSync(path.join(root, successfulPath.evidencePath))) {
      fail("The successful-path evidence file is missing.");
    }
    for (const [name, expected] of Object.entries(deployment.contracts)) {
      if (!sameAddress(settlementEvidence?.contracts?.[name], expected)) {
        fail(`Successful evidence contract ${name} does not match the current deployment.`);
      }
    }
  }

  const rejectionKinds = new Set(manifest.rejectedPaths?.map((entry) => entry.kind));
  for (const required of ["wrong-token", "wrong-sender-or-recipient", "replay"]) {
    if (!rejectionKinds.has(required)) fail(`Submission evidence is missing the ${required} rejection path.`);
  }
  for (const rejection of manifest.rejectedPaths ?? []) {
    if (!rejection.evidencePath || !existsSync(path.join(root, rejection.evidencePath))) {
      fail(`Rejection evidence is missing for ${rejection.kind ?? "an unnamed path"}.`);
    }
  }

  if (manifest.checks?.offline !== "pass") fail("Offline release checks are not recorded as passed.");
  if (manifest.checks?.liveEvidence === "not-run" || !manifest.checks?.liveEvidence) {
    fail("Live evidence was not checked.");
  } else if (manifest.checks.liveEvidence !== "pass") {
    fail("Live evidence checks did not pass.");
  }
  if (!manifest.checks?.checkedAt || Number.isNaN(Date.parse(manifest.checks.checkedAt))) {
    fail("Submission checks need a valid checkedAt timestamp.");
  }
  if (!manifest.knownLimitations || !existsSync(path.join(root, manifest.knownLimitations))) {
    fail("The submission manifest must reference the current known limitations document.");
  }

  return [...new Set(failures)];
}
