import Link from "next/link";
import { AcquisitionDetail } from "@/features/acquisitions/AcquisitionDetail";

export default async function AcquisitionPage({ params }: { params: Promise<{ mandateId: string }> }) {
  const { mandateId } = await params;
  if (!/^[1-9]\d*$/.test(mandateId)) return <section className="border-y border-line py-12"><h1 className="text-2xl font-medium">We couldn&apos;t find that acquisition.</h1><Link href="/acquisitions" className="mt-6 inline-flex min-h-11 items-center text-sm underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal">View acquisitions</Link></section>;
  try { BigInt(mandateId); } catch { return <section className="border-y border-line py-12"><h1 className="text-2xl font-medium">We couldn&apos;t find that acquisition.</h1><Link href="/acquisitions" className="mt-6 inline-flex min-h-11 items-center text-sm underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal">View acquisitions</Link></section>; }
  return <AcquisitionDetail mandateId={mandateId} />;
}
