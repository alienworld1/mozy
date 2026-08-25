import { attestcoinEnvironment as config } from "../../../config/attestcoin-environment.js";
import { loadRuntimeEnvironment, validatePublicConfiguration } from "../environment.js";
import { loadExpectation } from "../expectation.js";
import type { CommandOutput } from "../output.js";
import { createForeignProvider } from "../providers.js";
import { inspectReceipt } from "../receipt.js";
import { requireTransactionHash } from "../validation.js";

export async function inspectCommand(values: Record<string, string>, output: CommandOutput): Promise<unknown> {
  const hash = requireTransactionHash(values.tx);
  await validatePublicConfiguration();
  const runtime = loadRuntimeEnvironment({ requireSigner: false, requireProbe: false });
  const expectation = await loadExpectation(hash);
  output.phase("Waiting for source receipt", hash);
  const receipt = await inspectReceipt(createForeignProvider(runtime.foreignRpcUrl), hash, expectation, false);
  const result = {
    ok: true,
    receipt,
    semanticChecks: {
      receiptSuccess: "pass",
      transactionTarget: "pass",
      token: "pass",
      sender: "pass",
      recipient: "pass",
      amount: "pass",
    },
    explorerUrl: `${config.foreign.explorerUrl}/tx/${hash}`,
    nextCommand: `pnpm attestcoin:prove --tx ${hash}`,
  };
  output.phase("Receipt semantics match", `${receipt.transferAmount} base units at log ${receipt.transferLogIndex}`);
  output.phase("Next command", result.nextCommand);
  return result;
}
