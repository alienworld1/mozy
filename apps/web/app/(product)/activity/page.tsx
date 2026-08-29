import { PageHeader } from "@/components/shell/PageHeader";
import { ActivityWorkspace } from "@/features/activity/ActivityWorkspace";

export default function ActivityPage() {
  return (
    <>
      <PageHeader
        title="Activity"
        description="Follow confirmed acquisition, delivery, verification, and settlement activity."
      />
      <ActivityWorkspace />
    </>
  );
}
