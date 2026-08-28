"use client";

import { InlineRecoveryMessage } from "@/components/states/InlineRecoveryMessage";
import { StructuralSkeleton } from "@/components/states/StructuralSkeleton";
import { ReservationWorkspaceContent } from "./ReservationWorkspaceContent";
import { useReservationWorkspace } from "./useReservationWorkspace";

export function ReservationWorkspace({
  reservationId,
}: {
  reservationId: string;
}) {
  const query = useReservationWorkspace(BigInt(reservationId));
  if (query.isLoading) return <StructuralSkeleton variant="instrument" />;
  if (query.isError || !query.data)
    return (
      <InlineRecoveryMessage
        title="We couldn’t find that reservation."
        message="The reservation ID or its configured delivery requirements could not be read from Creditcoin."
        onRetry={() => void query.refetch()}
      />
    );
  return (
    <ReservationWorkspaceContent
      data={query.data}
      onRefresh={() => void query.refetch()}
    />
  );
}
