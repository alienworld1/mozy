import { RouteNotFound } from "@/components/states/RouteNotFound";
import { SolverMandateDetail } from "@/features/solver/SolverMandateDetail";

export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ mandateId: string }>;
}) {
  const { mandateId } = await params;
  if (!/^[1-9]\d*$/.test(mandateId))
    return (
      <RouteNotFound
        title="We couldn't find that acquisition."
        href="/markets"
        linkLabel="Back to markets"
      />
    );
  try {
    BigInt(mandateId);
  } catch {
    return (
      <RouteNotFound
        title="We couldn't find that acquisition."
        href="/markets"
        linkLabel="Back to markets"
      />
    );
  }
  return <SolverMandateDetail mandateId={mandateId} />;
}
