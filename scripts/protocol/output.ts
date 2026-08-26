import { ProtocolCommandError, messageOf } from "./errors.js";

export class ProtocolOutput {
  phase(label: string, detail?: string): void {
    process.stdout.write(`${label}${detail ? `: ${detail}` : ""}\n`);
  }

  transaction(label: string, hash: string, explorerUrl: string): void {
    this.phase(label, hash);
    this.phase("Explorer", `${explorerUrl}/tx/${hash}`);
  }

  failure(error: unknown, secrets: string[]): number {
    const normalized = error instanceof ProtocolCommandError
      ? error
      : new ProtocolCommandError(
          "Protocol command failed",
          messageOf(error),
          "Inspect any submitted transaction hash before retrying. No network write is retried automatically.",
        );
    const redact = (value: string): string =>
      secrets.filter(Boolean).reduce((result, secret) => result.replaceAll(secret, "[redacted]"), value);
    process.stderr.write(
      `${normalized.phase}\nCause: ${redact(normalized.message)}\nRecovery: ${normalized.recovery}\n`,
    );
    return normalized.exitCode;
  }
}
