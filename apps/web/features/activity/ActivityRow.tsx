import Link from "next/link";
import { RiArrowRightLine } from "react-icons/ri";
import type { ActivityItem } from "./types";

const dateTime = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "medium",
});

export function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <li className="grid gap-4 border-b border-line py-6 md:grid-cols-[11rem_minmax(0,1fr)_10rem_auto] md:items-center">
      <div>
        <span className="block text-[10px] tracking-wide text-ink-tertiary md:hidden">TIME</span>
        <time
          dateTime={item.occurredAt}
          title={item.occurredAt}
          className="font-mono text-xs text-ink-secondary"
        >
          {dateTime.format(new Date(item.occurredAt))}
        </time>
      </div>
      <div className="min-w-0">
        <span className="block text-[10px] tracking-wide text-ink-tertiary md:hidden">EVENT</span>
        <p className="text-[15px] font-medium">{item.title}</p>
        {item.detail ? <p className="mt-1 text-sm text-ink-secondary">{item.detail}</p> : null}
      </div>
      <div>
        <span className="block text-[10px] tracking-wide text-ink-tertiary md:hidden">REFERENCE</span>
        <p className="font-mono text-xs">
          {item.mandateId ? `M${item.mandateId}` : null}
          {item.mandateId && item.reservationId ? " · " : null}
          {item.reservationId ? `R${item.reservationId}` : null}
        </p>
      </div>
      <Link
        href={item.destination.href}
        className="inline-flex min-h-11 items-center gap-2 justify-self-start text-sm font-medium underline decoration-line-strong underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal md:justify-self-end"
      >
        {item.destination.label}
        <RiArrowRightLine aria-hidden="true" />
      </Link>
    </li>
  );
}

