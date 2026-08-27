import { PageHeader } from "@/components/shell/PageHeader";
import { WalletScopedEmptyState } from "@/components/states/WalletScopedEmptyState";

export default function AcquisitionsPage() {
  return (
    <>
      <PageHeader
        title="Acquisitions"
        description="Create and manage acquisition mandates funded on Creditcoin."
      />
      <WalletScopedEmptyState
        disconnectedMessage="Connect your wallet to view acquisition mandates for this address."
        connectedMessage="Your acquisition mandates will appear here."
      />
    </>
  );
}
