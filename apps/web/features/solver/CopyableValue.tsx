"use client";

import { useState } from "react";

export function CopyableValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="min-w-0">
      <span className="block text-xs text-ink-tertiary">{label}</span>
      <button
        type="button"
        disabled={!value}
        title={value}
        aria-label={`Copy ${label}: ${value}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
        className="mt-1 block min-h-11 max-w-full truncate font-mono text-xs underline decoration-line-strong underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal"
      >
        {value}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? `${label} copied` : ""}
      </span>
    </div>
  );
}
