import { RouteNotFound } from "@/components/states/RouteNotFound";
import { ReservationWorkspace } from "@/features/solver/ReservationWorkspace";

export default async function ReservationWorkspacePage({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  const { reservationId } = await params;
  if (!/^[1-9]\d*$/.test(reservationId))
    return (
      <RouteNotFound
        title="We couldn't find that reservation."
        href="/solver"
        linkLabel="Back to solver"
      />
    );
  try {
    BigInt(reservationId);
  } catch {
    return (
      <RouteNotFound
        title="We couldn't find that reservation."
        href="/solver"
        linkLabel="Back to solver"
      />
    );
  }
  return <ReservationWorkspace reservationId={reservationId} />;
}
