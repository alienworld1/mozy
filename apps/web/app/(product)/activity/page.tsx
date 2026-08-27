import { EmptyState } from "@/components/states/EmptyState";
import { PageHeader } from "@/components/shell/PageHeader";

export default function ActivityPage() {
  return (
    <>
      <PageHeader
        title="Activity"
        description="Follow real acquisition, delivery, verification, and settlement events."
      />
      <EmptyState message="Protocol activity will appear here." />
    </>
  );
}
