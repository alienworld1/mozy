import type { ButtonHTMLAttributes } from "react";

export function DisabledAction({
  reason,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { reason?: string }) {
  const reasonId = reason
    ? `disabled-reason-${reason.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
    : undefined;

  return (
    <div>
      <button
        {...props}
        type="button"
        disabled
        aria-describedby={reasonId}
        className="min-h-11 rounded-control border border-line-strong bg-wash px-4 text-sm font-medium text-ink-tertiary disabled:cursor-not-allowed"
      >
        {children}
      </button>
      {reason ? (
        <p id={reasonId} className="mt-2 text-xs leading-5 text-ink-tertiary">
          {reason}
        </p>
      ) : null}
    </div>
  );
}
