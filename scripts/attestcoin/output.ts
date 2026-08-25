import { AttestcoinError, errorMessage } from "./errors.js";

export class CommandOutput {
  constructor(private readonly json: boolean) {}

  phase(name: string, detail?: string): void {
    if (!this.json) process.stdout.write(`${name}${detail ? `: ${detail}` : ""}\n`);
  }

  success(result: unknown): void {
    if (this.json) process.stdout.write(`${JSON.stringify(result)}\n`);
  }

  failure(error: unknown, secrets: string[] = []): number {
    const normalized =
      error instanceof AttestcoinError
        ? error
        : new AttestcoinError(
            "Unexpected failure",
            "configuration_error",
            errorMessage(error),
            "Review the command inputs and retry. If the error persists, reconcile the pinned environment.",
          );
    const redact = (value: string): string =>
      secrets.filter(Boolean).reduce((message, secret) => message.replaceAll(secret, "[redacted]"), value);
    const result = {
      ok: false,
      phase: normalized.phase,
      errorClass: normalized.errorClass,
      cause: redact(normalized.message),
      recovery: normalized.recovery,
    };
    const serialized = this.json
      ? JSON.stringify(result)
      : `${result.phase}\nError class: ${result.errorClass}\nCause: ${result.cause}\nRecovery: ${result.recovery}\n`;
    process.stderr.write(serialized.endsWith("\n") ? serialized : `${serialized}\n`);
    return normalized.exitCode;
  }
}
