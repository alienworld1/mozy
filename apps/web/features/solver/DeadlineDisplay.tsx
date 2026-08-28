"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/features/acquisitions/format";

export function DeadlineDisplay({ deadline }: { deadline: bigint }) {
  const [now, setNow] = useState(() => BigInt(Math.floor(Date.now() / 1000)));
  useEffect(() => {
    const interval = window.setInterval(
      () => setNow(BigInt(Math.floor(Date.now() / 1000))),
      1_000,
    );
    return () => window.clearInterval(interval);
  }, []);
  const remaining = deadline - now;
  const label =
    remaining <= 0n
      ? "Deadline passed"
      : `${remaining / 3600n}h ${(remaining % 3600n) / 60n}m ${remaining % 60n}s remaining`;
  return (
    <div>
      <p className="font-mono text-lg tabular-nums">{label}</p>
      <p className="mt-1 text-sm text-ink-secondary">
        Exact deadline: {formatDateTime(deadline)}
      </p>
    </div>
  );
}
