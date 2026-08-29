"use client";

import { useQuery } from "@tanstack/react-query";

export function useReceiptAvailability(reservationIds: string[]) {
  const stableIds = [...new Set(reservationIds)].sort();
  return useQuery({
    queryKey: ["receipt-availability", stableIds.join(",")],
    enabled: stableIds.length > 0,
    queryFn: async () => {
      const params = new URLSearchParams();
      for (const id of stableIds) params.append("reservationId", id);
      const response = await fetch(`/api/receipts/availability?${params}`);
      const body = (await response.json()) as {
        availableReservationIds?: string[];
        message?: string;
      };
      if (!response.ok) throw new Error(body.message ?? "Receipt availability is being refreshed.");
      return new Set(body.availableReservationIds ?? []);
    },
    retry: false,
    refetchInterval: 15_000,
  });
}

