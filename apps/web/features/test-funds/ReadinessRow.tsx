import { IoCheckmarkOutline, IoOpenOutline, IoTimeOutline } from "react-icons/io5";

export function ReadinessRow({
  label,
  network,
  value,
  state,
  detail,
  href,
  hrefLabel,
}: {
  label: string;
  network: string;
  value: string;
  state: "ready" | "needed" | "pending" | "unavailable";
  detail: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <li className="grid gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-6">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 text-xs text-ink-tertiary">{network}</p>
      </div>
      <div>
        <p className="font-mono text-sm tabular-nums">{value}</p>
        <p className="mt-1 text-xs leading-5 text-ink-secondary">{detail}</p>
      </div>
      <div className="flex min-w-28 items-center gap-2 text-xs font-medium uppercase tracking-wide">
        {state === "ready" ? <IoCheckmarkOutline aria-hidden="true" className="h-4 w-4 text-success" /> : <IoTimeOutline aria-hidden="true" className={`h-4 w-4 ${state === "unavailable" ? "text-error" : "text-pending"}`} />}
        <span className={state === "ready" ? "text-success" : state === "unavailable" ? "text-error" : "text-pending"}>
          {state === "ready" ? "Ready" : state === "pending" ? "Confirming" : state === "unavailable" ? "Unavailable" : "Needed"}
        </span>
      </div>
      {href && hrefLabel ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-xs font-medium underline decoration-line-strong underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal sm:col-start-2">
          {hrefLabel}<IoOpenOutline aria-hidden="true" className="h-4 w-4" />
        </a>
      ) : null}
    </li>
  );
}
