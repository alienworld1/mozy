import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Node 24 can emit the CLI close event before all captured --showConfig output.
  // The compiler API avoids that truncation while keeping the same type check.
  experimental: { useTypeScriptCli: false },
};

export default nextConfig;
