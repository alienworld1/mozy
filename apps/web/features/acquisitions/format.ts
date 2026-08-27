import { formatUnits } from "viem";

export function formatTokenAmount(value: bigint, decimals: number, maximumDecimals = 6) {
  const formatted = formatUnits(value, decimals);
  const [whole, fraction = ""] = formatted.split(".");
  const trimmed = fraction.slice(0, maximumDecimals).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function formatExactTokenAmount(value: bigint, decimals: number) {
  return formatTokenAmount(value, decimals, decimals);
}

export function formatDateTime(timestamp: bigint) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(Number(timestamp) * 1000));
}

export function formatDuration(seconds: bigint) {
  const hours = seconds / 3600n;
  const minutes = (seconds % 3600n) / 60n;
  if (hours > 0n && minutes > 0n) return `${hours}h ${minutes}m`;
  if (hours > 0n) return `${hours}h`;
  return `${minutes}m`;
}
