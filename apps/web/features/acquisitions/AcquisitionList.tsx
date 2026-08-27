"use client";

import { getAddress, isAddress } from "viem";
import { useConnection } from "wagmi";
import { EmptyState } from "@/components/states/EmptyState";
import { InlineRecoveryMessage } from "@/components/states/InlineRecoveryMessage";
import { StructuralSkeleton } from "@/components/states/StructuralSkeleton";
import { MandateScheduleRow } from "./MandateScheduleRow";
import { useOwnedAcquisitions } from "./useOwnedAcquisitions";
import { UnavailableMandateRow } from "./UnavailableMandateRow";

export function AcquisitionList() {
  const connection = useConnection();
  const buyer = connection.address && isAddress(connection.address) ? getAddress(connection.address) : undefined;
  const query = useOwnedAcquisitions(buyer);

  if (!buyer) return <EmptyState message="Connect your wallet to view acquisition mandates for this address." />;
  if (query.isLoading) return <div className="mt-10"><StructuralSkeleton /></div>;
  if (query.isError) return <InlineRecoveryMessage title="Acquisitions unavailable" message="We couldn't load your acquisitions. Try again." onRetry={() => void query.refetch()} />;
  if (!query.data?.length) return <EmptyState message="Acquire assets without moving your whole treasury first." />;

  const available = query.data.flatMap((item) => item.acquisition ? [item.acquisition] : []);
  const unavailable = query.data.filter((item) => item.unavailable);
  const current = available.filter(({ mandate }) => mandate.status !== 6);
  const history = available.filter((item) => !current.includes(item));
  return (
    <div className="mt-12 space-y-12">
      {current.length ? <section><h2 className="mb-4 text-lg font-medium">{history.length ? "Current" : "Your acquisitions"}</h2><div className="border-t border-line">{current.map((item) => <MandateScheduleRow key={item.mandate.id.toString()} acquisition={item} />)}</div></section> : null}
      {history.length ? <section><h2 className="mb-4 text-lg font-medium">{current.length ? "History" : "Your acquisitions"}</h2><div className="border-t border-line">{history.map((item) => <MandateScheduleRow key={item.mandate.id.toString()} acquisition={item} />)}</div></section> : null}
      {unavailable.length ? <section><h2 className="mb-4 text-lg font-medium">Needs refresh</h2><div className="border-t border-line">{unavailable.map((item) => <UnavailableMandateRow key={item.mandateId.toString()} mandateId={item.mandateId} onRetry={() => void query.refetch()} />)}</div></section> : null}
    </div>
  );
}
