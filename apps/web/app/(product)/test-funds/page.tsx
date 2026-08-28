import { PageHeader } from "@/components/shell/PageHeader";
import { TestFundsWorkspace } from "@/features/test-funds/TestFundsWorkspace";

export default function TestFundsPage() {
  return (
    <>
      <PageHeader title="Test funds" description="Prepare one connected wallet with the testnet tokens needed to try Mozy as a buyer or solver." />
      <TestFundsWorkspace />
    </>
  );
}
