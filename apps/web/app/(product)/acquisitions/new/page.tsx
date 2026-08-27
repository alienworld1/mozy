import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { AcquisitionForm } from "@/features/acquisitions/AcquisitionForm";

export default function NewAcquisitionPage() {
  return (
    <>
      <Link href="/acquisitions" className="mb-6 inline-flex min-h-11 items-center text-sm text-ink-secondary underline decoration-line-strong underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal">Back to acquisitions</Link>
      <PageHeader title="New acquisition" description="Set the exact delivery terms and maximum BTKT commitment before opening." />
      <AcquisitionForm />
    </>
  );
}
