#!/usr/bin/env node
import "dotenv/config";
import { deployProtocol } from "./deploy.js";
import { inspectProtocol } from "./inspect.js";
import { ProtocolCommandError } from "./errors.js";
import { ProtocolOutput } from "./output.js";

function parseValues(arguments_: string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (let index = 0; index < arguments_.length; index += 2) {
    const key = arguments_[index];
    const value = arguments_[index + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--")) {
      throw new ProtocolCommandError("Validating arguments", `Invalid argument near ${key ?? "end of command"}.`, "Use --help to review the command syntax.");
    }
    values[key.slice(2)] = value;
  }
  return values;
}

async function main(): Promise<void> {
  const output = new ProtocolOutput();
  const command = process.argv[2];
  try {
    if (process.argv.includes("--help")) {
      process.stdout.write("pnpm protocol:deploy\npnpm protocol:inspect [--mandate <id>] [--reservation <id>] [--registry <address> --market <address> --vault <address> --admin <address>]\n");
      return;
    }
    if (command === "deploy") await deployProtocol(output);
    else if (command === "inspect") {
      const values = parseValues(process.argv.slice(3));
      const unknown = Object.keys(values).filter((key) => !["mandate", "reservation", "registry", "market", "vault", "admin"].includes(key));
      if (unknown.length > 0) throw new ProtocolCommandError("Validating arguments", `Unknown argument: --${unknown[0]}.`, "Use --help to review the command syntax.");
      await inspectProtocol(values, output);
    }
    else throw new ProtocolCommandError("Validating command", `Unknown command: ${command ?? "none"}.`, "Use protocol:deploy or protocol:inspect.");
  } catch (error) {
    process.exitCode = output.failure(error, [
      process.env.MOZY_DEPLOYER_PRIVATE_KEY ?? "",
      process.env.CREDITCOIN_RPC_URL ?? "",
    ]);
  }
}

await main();
