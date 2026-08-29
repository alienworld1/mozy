"use client";

import { InlineRecoveryMessage } from "@/components/states/InlineRecoveryMessage";

export default function ProductError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <InlineRecoveryMessage
      title="We couldn’t load this workspace."
      message="The workspace did not finish loading. Nothing was submitted and no economic state was assumed to change."
      onRetry={reset}
    />
  );
}
