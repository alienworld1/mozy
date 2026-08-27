export type WalletErrorKind =
  | "user_rejected"
  | "switch_unavailable"
  | "provider_failure";

function containsCode(error: unknown, code: number): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; cause?: unknown };
  return candidate.code === code || containsCode(candidate.cause, code);
}

export function classifyWalletError(error: unknown): WalletErrorKind {
  if (containsCode(error, 4001)) return "user_rejected";
  if (
    error instanceof Error &&
    ["SwitchChainNotSupportedError", "ChainNotConfiguredError"].includes(
      error.name,
    )
  ) {
    return "switch_unavailable";
  }
  return "provider_failure";
}
