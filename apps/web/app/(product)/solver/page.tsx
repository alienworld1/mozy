import { PageHeader } from "@/components/shell/PageHeader";
import { SolverSchedule } from "@/features/solver/SolverSchedule";

export default function SolverPage() {
  return (
    <>
      <PageHeader
        title="Solver"
        description="Reserve delivery work and follow each payout."
      />
      <SolverSchedule />
    </>
  );
}
