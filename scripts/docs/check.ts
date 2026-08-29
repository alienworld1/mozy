import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { attestcoinEnvironment } from "../../config/attestcoin-environment.js";

type Deployment = {
  environmentConfigVersion: string;
  chainId: number;
  contracts: Record<string, string>;
  marketId: string;
  deploymentBlock: string;
  bondPolicy: Record<string, string>;
  sourceWindowPolicy: Record<string, string>;
};

const root = process.cwd();
const docsDirectory = path.join(root, "docs");
const requiredDocuments = [
  "whitepaper.md",
  "architecture.md",
  "attestcoin.md",
  "security.md",
  "runbook.md",
  "protocol-runbook.md",
  "settlement-model.md",
] as const;
const deployment = JSON.parse(
  readFileSync(path.join(root, "artifacts/protocol/cc3-settlement.json"), "utf8"),
) as Deployment;
const failures: string[] = [];

function fail(message: string) {
  failures.push(message);
}

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

for (const file of requiredDocuments) {
  const target = path.join(docsDirectory, file);
  if (!existsSync(target) || !statSync(target).isFile()) {
    fail(`Missing required document: docs/${file}`);
  }
}

const markdownFiles = requiredDocuments
  .filter((file) => existsSync(path.join(docsDirectory, file)))
  .map((file) => ({
    path: `docs/${file}`,
    absolutePath: path.join(docsDirectory, file),
    content: read(`docs/${file}`),
  }));

function headingAnchor(heading: string) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

for (const document of markdownFiles) {
  const links = document.content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g);
  for (const match of links) {
    const destination = match[1];
    if (
      destination.startsWith("http://") ||
      destination.startsWith("https://") ||
      destination.startsWith("mailto:")
    ) {
      continue;
    }
    const [filePart, fragment] = destination.split("#");
    const targetPath = path.resolve(
      path.dirname(document.absolutePath),
      filePart || path.basename(document.absolutePath),
    );
    if (!existsSync(targetPath)) {
      fail(`${document.path} links to missing path: ${destination}`);
      continue;
    }
    if (fragment && targetPath.endsWith(".md")) {
      const anchors = new Set(
        [...readFileSync(targetPath, "utf8").matchAll(/^#{1,6}\s+(.+)$/gm)].map(
          (heading) => headingAnchor(heading[1]),
        ),
      );
      if (!anchors.has(fragment)) {
        fail(`${document.path} links to missing anchor: ${destination}`);
      }
    }
  }
}

const rootPackage = JSON.parse(read("package.json")) as {
  scripts: Record<string, string>;
};
for (const document of markdownFiles) {
  for (const match of document.content.matchAll(/\bpnpm\s+([a-z][\w:-]*)/g)) {
    const command = match[1];
    if (command !== "install" && !rootPackage.scripts[command]) {
      fail(`${document.path} references missing pnpm script: ${command}`);
    }
  }
}

const architectureFacts = [
  attestcoinEnvironment.configVersion,
  String(attestcoinEnvironment.creditcoin.chainId),
  String(attestcoinEnvironment.foreign.chainId),
  String(attestcoinEnvironment.foreign.sourceChainKey),
  attestcoinEnvironment.deliveryToken.address,
  attestcoinEnvironment.settlementToken.address,
  String(attestcoinEnvironment.deliveryToken.decimals),
  deployment.marketId,
  deployment.deploymentBlock,
  ...Object.values(deployment.contracts),
  deployment.bondPolicy.rateBps,
  deployment.bondPolicy.cap,
  deployment.bondPolicy.denominator,
  deployment.sourceWindowPolicy.acceptedBlocks,
  deployment.sourceWindowPolicy.settlementGraceBlocks,
  deployment.sourceWindowPolicy.bounds,
  attestcoinEnvironment.attestcoin.contractsPackage,
  attestcoinEnvironment.attestcoin.sdkPackage,
] as const;

const architecture = read("docs/architecture.md");
for (const fact of architectureFacts) {
  if (!architecture.includes(fact)) {
    fail(`docs/architecture.md is missing release fact: ${fact}`);
  }
}

const attestcoin = read("docs/attestcoin.md");
for (const fact of [
  attestcoinEnvironment.configVersion,
  attestcoinEnvironment.attestcoin.verifierAddress,
  attestcoinEnvironment.attestcoin.chainInfoAddress,
  attestcoinEnvironment.attestcoin.decoderAddress,
  attestcoinEnvironment.attestcoin.contractsPackage,
  attestcoinEnvironment.attestcoin.sdkPackage,
  deployment.contracts.settlement,
  deployment.sourceWindowPolicy.acceptedBlocks,
  deployment.sourceWindowPolicy.settlementGraceBlocks,
]) {
  if (!attestcoin.includes(fact)) {
    fail(`docs/attestcoin.md is missing release fact: ${fact}`);
  }
}

if (deployment.environmentConfigVersion !== attestcoinEnvironment.configVersion) {
  fail("Deployment and Attestcoin environment config versions do not match");
}
if (deployment.chainId !== attestcoinEnvironment.creditcoin.chainId) {
  fail("Deployment and configured Creditcoin chain IDs do not match");
}

const howPage = read("apps/web/app/(product)/how-mozy-works/page.tsx");
for (const id of [
  "buyers",
  "solvers",
  "verification-time",
]) {
  if (!howPage.includes(`id=\"${id}\"`) && !howPage.includes(`id={\"${id}\"}`)) {
    if (!howPage.includes(`id=\"${id}\"`)) {
      fail(`How page source is missing anchor: #${id}`);
    }
  }
}
for (const featureFile of [
  "apps/web/features/education/ProductFlow.tsx",
  "apps/web/features/education/TrustFlow.tsx",
  "apps/web/features/education/Glossary.tsx",
  "apps/web/features/education/SupportedRelease.tsx",
]) {
  const content = read(featureFile);
  const required = featureFile.includes("ProductFlow")
      ? "flow"
    : featureFile.includes("TrustFlow")
      ? "trust"
      : featureFile.includes("SupportedRelease")
        ? "supported-release"
      : "glossary";
  if (!content.includes(`id=\"${required}\"`)) {
    fail(`${featureFile} is missing anchor: #${required}`);
  }
}
const verificationSequence = read(
  "apps/web/features/solver/VerificationSequence.tsx",
);
if (!verificationSequence.includes('/how-mozy-works#verification-time')) {
  fail("Verification sequence is missing the proof-latency education link");
}

if (failures.length) {
  process.stderr.write(
    `Documentation check failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Documentation check passed (${requiredDocuments.length} documents, release facts, commands, links, and product anchors).\n`,
  );
}
