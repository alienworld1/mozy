import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { AcquisitionList } from "@/features/acquisitions/AcquisitionList";

export default function AcquisitionsPage() {
  return (
    <>
      <div className="flex flex-col gap-6 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader title="Acquisitions" description="Create and manage acquisition mandates funded on Creditcoin." />
        <Link href="/acquisitions/new" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-control bg-signal px-4 text-sm font-medium text-paper-raised outline-none hover:bg-signal-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">New acquisition</Link>
      </div>
      <AcquisitionList />
    </>
  );
}
