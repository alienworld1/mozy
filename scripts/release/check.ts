import { readFileSync } from "node:fs";
import path from "node:path";
import { attestcoinEnvironment } from "../../config/attestcoin-environment.js";
import { validateSubmissionRelease, type ReleaseDeployment, type SubmissionManifest } from "./validation.js";

const root = process.cwd();
const readJson = <T>(relativePath: string) => JSON.parse(
  readFileSync(path.join(root, relativePath), "utf8"),
) as T;

const manifest = readJson<SubmissionManifest>("artifacts/submission/evidence.json");
const deployment = readJson<ReleaseDeployment>("artifacts/protocol/cc3-settlement.json");
const settlementEvidence = readJson<{ deploymentArtifact?: string; contracts?: Record<string, string> }>(
  "artifacts/protocol/cc3-settlement-evidence.json",
);
const failures = validateSubmissionRelease({
  root,
  environment: attestcoinEnvironment,
  deployment,
  manifest,
  settlementEvidence,
});
const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined);
if (!configuredOrigin || !manifest.deployedAppUrl) {
  failures.push("Set NEXT_PUBLIC_SITE_URL to the final HTTPS product origin.");
} else {
  try {
    const configured = new URL(configuredOrigin);
    const deployed = new URL(manifest.deployedAppUrl);
    if (configured.protocol !== "https:" || configured.origin !== deployed.origin) {
      failures.push("NEXT_PUBLIC_SITE_URL does not match the deployed app URL.");
    }
  } catch {
    failures.push("NEXT_PUBLIC_SITE_URL does not match the deployed app URL.");
  }
}

if (failures.length) {
  process.stderr.write(`Release validation failed:\n${[...new Set(failures)].map((failure) => `- ${failure}`).join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Release validation passed: deployment, evidence, documentation, and public URLs agree.\n");
}
