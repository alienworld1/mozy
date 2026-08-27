import { PageHeader } from "@/components/shell/PageHeader";
import { WalletScopedEmptyState } from "@/components/states/WalletScopedEmptyState";

export default function SolverPage() {
  return (
    <>
      <PageHeader
        title="Solver"
        description="Reserve delivery work and follow each payout."
      />
      <WalletScopedEmptyState
        disconnectedMessage="Connect your wallet to view reservations and deliveries for this address."
        connectedMessage="Your reservations and deliveries will appear here."
      />
    </>
  );
}
