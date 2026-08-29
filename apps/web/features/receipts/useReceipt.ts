"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReceiptResponse } from "./types";

export function useReceipt(reservationId: string) {
  return useQuery({
    queryKey: ["delivery-receipt", reservationId],
    queryFn: async (): Promise<ReceiptResponse> => {
      const response = await fetch(`/api/receipts/${reservationId}`);
      const body = (await response.json()) as ReceiptResponse;
      if (!body || typeof body !== "object" || !("status" in body))
        throw new Error("Receipt response unavailable");
      return body;
    },
    retry: false,
    refetchOnWindowFocus: true,
  });
}

