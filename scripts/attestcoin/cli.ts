#!/usr/bin/env node
import { parseArguments } from "./arguments.js";
import { evidenceCheckCommand } from "./commands/evidence-check-command.js";
import { inspectCommand } from "./commands/inspect-command.js";
import { preflightCommand } from "./commands/preflight-command.js";
import { proveCommand } from "./commands/prove-command.js";
import { transferCommand } from "./commands/transfer-command.js";
import { verifyCommand } from "./commands/verify-command.js";
import { AttestcoinError } from "./errors.js";
import { CommandOutput } from "./output.js";

const help: Record<string, string> = {
  preflight: `Validate the pinned CC3 Testnet, Sepolia, token, Attestcoin, proof-builder, probe, and disposable-wallet configuration.

Usage: pnpm attestcoin:preflight [--json]`,
  transfer: `Send exactly one ordinary ERC-20 transfer on Sepolia and inspect its receipt. This command never retries a transfer.

Usage: pnpm attestcoin:transfer --recipient <buyer-address> --amount <positive-base-unit-integer> [--json]`,
  inspect: `Inspect a recorded source receipt without sending a transaction.

Usage: pnpm attestcoin:inspect --tx <foreign-transaction-hash> [--json]`,
  prove: `Retrieve real Merkle and continuity proof material for a recorded source receipt.

Usage: pnpm attestcoin:prove --tx <foreign-transaction-hash> [--json]`,
  verify: `Verify saved proof material through the Creditcoin semantic probe. Use --expect-recipient only for the non-mutating negative QA check.

Usage: pnpm attestcoin:verify --tx <foreign-transaction-hash> [--expect-recipient <address>] [--json]`,
  "evidence-check": `Revalidate the committed real-run evidence against both chains.

Usage: pnpm attestcoin:evidence:check [--json]`,
};

const allowedArguments: Record<string, Set<string>> = {
  preflight: new Set(),
  transfer: new Set(["recipient", "amount"]),
  inspect: new Set(["tx"]),
  prove: new Set(["tx"]),
  verify: new Set(["tx", "expect-recipient"]),
  "evidence-check": new Set(),
};

async function main(): Promise<void> {
  const command = process.argv[2];
  const parsed = parseArguments(process.argv.slice(3));
  const output = new CommandOutput(parsed.json);

  try {
    if (!command || !help[command]) {
      throw new AttestcoinError(
        "Validating arguments",
        "validation_error",
        `Unknown command: ${command ?? "none"}.`,
        "Use one of the documented root pnpm attestcoin:* scripts.",
      );
    }
    if (parsed.help) {
      process.stdout.write(`${help[command]}\n`);
      return;
    }
    const unknown = Object.keys(parsed.values).filter((key) => !allowedArguments[command].has(key));
    if (unknown.length > 0) {
      throw new AttestcoinError(
        "Validating arguments",
        "validation_error",
        `Unknown argument: --${unknown[0]}.`,
        "Run the command with --help to see supported arguments.",
      );
    }

    const result = await run(command, parsed.values, output);
    output.success(result);
  } catch (error) {
    const secrets = [
      process.env.ATTESTCOIN_DISPOSABLE_PRIVATE_KEY ?? "",
      process.env.CREDITCOIN_RPC_URL ?? "",
      process.env.FOREIGN_RPC_URL ?? "",
      process.env.ATTESTCOIN_PROOF_BUILDER_URL ?? "",
    ];
    process.exitCode = output.failure(error, secrets);
  }
}

function run(command: string, values: Record<string, string>, output: CommandOutput): Promise<unknown> {
  switch (command) {
    case "preflight":
      return preflightCommand(output);
    case "transfer":
      return transferCommand(values, output);
    case "inspect":
      return inspectCommand(values, output);
    case "prove":
      return proveCommand(values, output);
    case "verify":
      return verifyCommand(values, output);
    case "evidence-check":
      return evidenceCheckCommand(output);
    default:
      throw new Error("unreachable command");
  }
}

await main();
