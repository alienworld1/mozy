import { config as loadEnvironment } from "dotenv";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));

loadEnvironment({
  path: [`${workspaceRoot}.env.local`, `${workspaceRoot}.env`],
  quiet: true,
});

const nextConfig: NextConfig = {
  // Node 24 can emit the CLI close event before all captured --showConfig output.
  // The compiler API avoids that truncation while keeping the same type check.
  experimental: { useTypeScriptCli: false },
};

export default nextConfig;
