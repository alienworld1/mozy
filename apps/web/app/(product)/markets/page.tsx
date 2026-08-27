import { EmptyState } from "@/components/states/EmptyState";
import { PageHeader } from "@/components/shell/PageHeader";

export default function MarketsPage() {
  return (
    <>
      <PageHeader
        title="Markets"
        description="Funded acquisition demand across Mozy’s supported market."
      />
      <EmptyState message="Open acquisitions will appear here." />
    </>
  );
}
