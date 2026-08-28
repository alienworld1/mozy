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
        title={value}
        aria-label={`Copy ${label}: ${value}`}
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        }}
        className="mt-1 block min-h-11 max-w-full truncate font-mono text-xs underline decoration-line-strong underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal"
      >
        {copied ? `${label} copied` : value}
      </button>
    </div>
  );
}
