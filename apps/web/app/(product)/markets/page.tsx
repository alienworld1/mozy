import { PageHeader } from "@/components/shell/PageHeader";
import { MarketSchedule } from "@/features/markets/MarketSchedule";

export default function MarketsPage() {
  return (
    <>
      <PageHeader
        title="Markets"
        description="Funded acquisition demand across Mozy’s supported market."
      />
      <MarketSchedule />
    </>
  );
}
