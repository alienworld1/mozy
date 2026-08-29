"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import type { ActivityResponse } from "./types";

export class ActivityRequestError extends Error {
  constructor(
    message: string,
    readonly reason?: string,
  ) {
    super(message);
  }
}

export function useActivity() {
  return useInfiniteQuery({
    queryKey: ["activity"],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: "30" });
      if (pageParam) params.set("cursor", pageParam);
      const response = await fetch(`/api/activity?${params}`);
      const body = (await response.json()) as ActivityResponse & {
        reason?: string;
        message?: string;
      };
      if (!response.ok)
        throw new ActivityRequestError(
          body.message ?? "We couldn't load protocol activity.",
          body.reason,
        );
      return body;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
    refetchOnWindowFocus: true,
  });
}

