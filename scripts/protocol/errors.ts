export class ProtocolCommandError extends Error {
  constructor(
    readonly phase: string,
    message: string,
    readonly recovery: string,
    readonly exitCode = 1,
  ) {
    super(message);
  }
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
