"use client";

import { useQuery } from "@tanstack/react-query";
import { verificationResponseSchema } from "./verification";

export function useVerification(reservationId: string) {
  return useQuery({
    queryKey: ["reservation-verification", reservationId],
    queryFn: async () => {
      const response = await fetch(
        `/api/reservations/${reservationId}/verification`,
      );
      const body = await response.json().catch(() => undefined);
      if (!response.ok)
        throw new Error(
          body?.message ??
            "We couldn't refresh verification. Your delivery and reservation are unchanged.",
        );
      return verificationResponseSchema.parse(body);
    },
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      )
        return false;
      const data = query.state.data;
      const current = data?.candidates[0];
      return data?.canonicalReservationStatus === "Active" &&
        (!current || current.nextAction !== "none")
        ? 15_000
        : false;
    },
  });
}
