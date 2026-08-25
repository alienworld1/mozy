import { Contract, Wallet, getAddress } from "ethers";
import { attestcoinEnvironment as config } from "../../../config/attestcoin-environment.js";
import { ERC20_ABI } from "../constants.js";
import { AttestcoinError } from "../errors.js";
import { writeJson } from "../io.js";
import type { CommandOutput } from "../output.js";
import { transactionFile, transferRoot } from "../paths.js";
import { runPreflight } from "../preflight.js";
import { createForeignProvider } from "../providers.js";
import { createExpectation, inspectReceipt } from "../receipt.js";
import type { StoredTransfer } from "../types.js";
import { requireAddress, requirePositiveAmount } from "../validation.js";

export async function transferCommand(
  values: Record<string, string>,
  output: CommandOutput,
): Promise<unknown> {
  const recipient = requireAddress(values.recipient, "Recipient");
  const amount = requirePositiveAmount(values.amount);
  output.phase("Checking configuration");
  const { runtime, result: preflight } = await runPreflight();
  const sender = getAddress(preflight.operator);
  if (sender === recipient) {
    throw new AttestcoinError(
      "Validating arguments",
      "validation_error",
      "The solver and recipient addresses must be distinct for unambiguous evidence.",
      "Use a separate disposable buyer delivery address.",
    );
  }

  const provider = createForeignProvider(runtime.foreignRpcUrl);
  const wallet = new Wallet(runtime.privateKey, provider);
  const token = new Contract(config.deliveryToken.address, ERC20_ABI, wallet);
  const [senderBefore, recipientBefore] = await Promise.all([
    token.balanceOf(sender) as Promise<bigint>,
    token.balanceOf(recipient) as Promise<bigint>,
  ]);
  if (senderBefore < amount) {
    throw new AttestcoinError(
      "Checking configuration",
      "funding_error",
      "The disposable solver does not have enough delivery tokens for this amount.",
      "Mint TEST using the documented source-token funding command, then rerun preflight.",
    );
  }

  output.phase("Submitting source transfer", `${amount.toString()} base units to ${recipient}`);
  const transaction = await token.transfer(recipient, amount);
  output.phase("Foreign transaction", transaction.hash);
  output.phase("Waiting for source receipt");
  const receipt = await transaction.wait();
  if (!receipt || receipt.status !== 1) {
    throw new AttestcoinError(
      "Waiting for source receipt",
      "receipt_error",
      `The source transaction was submitted as ${transaction.hash} but was not confirmed successful.`,
      "Inspect the printed hash. Do not automatically resend the transfer.",
    );
  }

  const [senderAfter, recipientAfter] = await Promise.all([
    token.balanceOf(sender) as Promise<bigint>,
    token.balanceOf(recipient) as Promise<bigint>,
  ]);
  const expectation = createExpectation({ sender, recipient, amount });
  const stored: StoredTransfer = {
    schemaVersion: "1",
    foreignTxHash: transaction.hash.toLowerCase() as `0x${string}`,
    createdAt: new Date().toISOString(),
    expectation,
    senderBalanceBefore: senderBefore.toString(),
    senderBalanceAfter: senderAfter.toString(),
    recipientBalanceBefore: recipientBefore.toString(),
    recipientBalanceAfter: recipientAfter.toString(),
  };
  await writeJson(transactionFile(transferRoot, transaction.hash), stored);

  if (senderBefore - senderAfter !== amount || recipientAfter - recipientBefore !== amount) {
    throw new AttestcoinError(
      "Inspecting source receipt",
      "semantic_mismatch",
      `The token balance deltas do not match the requested transfer amount. Transaction: ${transaction.hash}.`,
      "Do not prove this receipt. The selected token does not exhibit the required standard transfer behavior.",
    );
  }

  const evidence = await inspectReceipt(provider, stored.foreignTxHash, expectation, false);
  const result = {
    ok: true,
    foreignTxHash: stored.foreignTxHash,
    explorerUrl: `${config.foreign.explorerUrl}/tx/${stored.foreignTxHash}`,
    receipt: evidence,
    nextCommand: `pnpm attestcoin:inspect --tx ${stored.foreignTxHash}`,
  };
  output.phase("Source receipt confirmed", stored.foreignTxHash);
  output.phase("Next command", result.nextCommand);
  return result;
}
