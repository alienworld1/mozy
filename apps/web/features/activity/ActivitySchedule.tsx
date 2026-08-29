import type { ActivityItem } from "./types";
import { ActivityRow } from "./ActivityRow";

export function ActivitySchedule({ items }: { items: ActivityItem[] }) {
  return (
    <section className="mt-10" aria-labelledby="activity-schedule-title">
      <h2 id="activity-schedule-title" className="sr-only">Protocol activity</h2>
      <div className="hidden border-y border-line py-3 font-mono text-[10px] tracking-wide text-ink-tertiary md:grid md:grid-cols-[11rem_minmax(0,1fr)_10rem_auto]" aria-hidden="true">
        <span>TIME</span>
        <span>EVENT</span>
        <span>REFERENCE</span>
        <span className="text-right">DESTINATION</span>
      </div>
      <ol className="border-t border-line md:border-t-0">
        {items.map((item) => <ActivityRow key={item.id} item={item} />)}
      </ol>
    </section>
  );
}
