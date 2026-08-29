import { spawnSync } from "node:child_process";

const offline = process.argv.includes("--offline");
const checks = [
  "protocol:build",
  "protocol:test",
  "pricing:test",
  "attestcoin:test",
  "attestcoin:typecheck",
  "worker:test",
  "worker:typecheck",
  "db:test",
  "web:test",
  "web:lint",
  "web:build",
  "docs:check",
  "release:test",
  ...(offline ? [] : ["attestcoin:evidence:check", "protocol:evidence:check"]),
  "release:validate",
] as const;

let failed = false;
for (const check of checks) {
  const result = spawnSync("pnpm", [check], { stdio: "ignore" });
  const passed = result.status === 0;
  failed ||= !passed;
  process.stdout.write(`${passed ? "PASS" : "FAIL"}  ${check}\n`);
}
if (offline) {
  process.stdout.write("NOT RUN  attestcoin:evidence:check — Live evidence was not checked.\n");
  process.stdout.write("NOT RUN  protocol:evidence:check — Live evidence was not checked.\n");
  failed = true;
}
if (failed) {
  process.stderr.write("Release check failed. Run each failed command directly for safe diagnostic output.\n");
  process.exitCode = 1;
} else {
  process.stdout.write("Release check passed.\n");
}
