import { runPreflight } from "../preflight.js";
import type { CommandOutput } from "../output.js";

export async function preflightCommand(output: CommandOutput): Promise<unknown> {
  output.phase("Checking configuration");
  const { result } = await runPreflight();
  output.phase("Configuration ready", `${result.operator} on both selected testnets`);
  output.phase("Source chain", `chain key ${result.sourceChain.chainKey}; attested height ${result.sourceChain.latestAttestedHeight}`);
  output.phase("Next command", "pnpm attestcoin:transfer --recipient <buyer-address> --amount <base-units>");
  return result;
}
