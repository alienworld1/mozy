"use client";

import { EmptyState } from "@/components/states/EmptyState";
import { InlineRecoveryMessage } from "@/components/states/InlineRecoveryMessage";
import { ActivitySchedule } from "./ActivitySchedule";
import { ActivitySkeleton } from "./ActivitySkeleton";
import { useActivity } from "./useActivity";
import { useQueryClient } from "@tanstack/react-query";

export function ActivityWorkspace() {
  const queryClient = useQueryClient();
  const query = useActivity();
  if (query.isLoading) return <ActivitySkeleton />;
  if (query.isError && !query.data)
    return (
      <InlineRecoveryMessage
        title="We couldn't load protocol activity."
        message="No protocol state was changed. Try again."
        onRetry={() => void query.refetch()}
      />
    );
  const pages = query.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const degraded = pages.some((page) => page.freshness === "degraded");
  if (!items.length)
    return (
      <>
        {degraded ? (
          <p className="mt-8 border-l-2 border-pending pl-4 text-sm text-ink-secondary" role="status">
            Activity may be delayed while confirmed events are refreshed.
          </p>
        ) : null}
        <EmptyState
          message="No protocol activity yet."
          supporting="Confirmed acquisition, reservation, delivery, and settlement activity will appear here."
        />
      </>
    );
  return (
    <>
      {degraded ? (
        <p className="mt-8 border-l-2 border-pending pl-4 text-sm text-ink-secondary" role="status">
          Activity may be delayed while confirmed events are refreshed.
        </p>
      ) : null}
      <ActivitySchedule items={items} />
      {query.isError ? (
        <div className="mt-5 border-l-2 border-error pl-4">
          <p className="text-sm text-error">We couldn&apos;t load earlier activity. Existing activity remains unchanged.</p>
          <button type="button" onClick={() => void queryClient.resetQueries({ queryKey: ["activity"] })} className="mt-2 min-h-11 text-sm underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal">Start from latest</button>
        </div>
      ) : null}
      {query.hasNextPage ? (
        <button
          type="button"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
          className="mt-8 min-h-11 rounded-control border border-line-strong px-4 text-sm font-medium outline-none hover:bg-wash disabled:cursor-wait disabled:text-ink-tertiary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
        >
          {query.isFetchingNextPage ? "Loading earlier activity…" : "Load earlier activity"}
        </button>
      ) : null}
    </>
  );
}
