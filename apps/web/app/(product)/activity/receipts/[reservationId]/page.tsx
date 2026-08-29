import { RouteNotFound } from "@/components/states/RouteNotFound";
import { ReceiptWorkspace } from "@/features/receipts/ReceiptWorkspace";
import { isReservationId } from "@/features/receipts/validation";

export default async function DeliveryReceiptPage({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  const { reservationId } = await params;
  if (!isReservationId(reservationId))
    return <RouteNotFound title="We couldn't find that delivery receipt." href="/activity" linkLabel="Back to activity" />;
  return <ReceiptWorkspace reservationId={reservationId} />;
}
