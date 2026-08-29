export type ActivityDestination = {
  href: string;
  label: string;
};

export type ActivityItem = {
  id: string;
  kind: "protocol_event" | "delivery_observation" | "worker_state";
  type: string;
  occurredAt: string;
  mandateId: string | null;
  reservationId: string | null;
  actor: string | null;
  title: string;
  detail: string | null;
  transactionHash: string | null;
  chain: "creditcoin" | "foreign" | "operational";
  destination: ActivityDestination;
};

export type ActivityResponse = {
  items: ActivityItem[];
  nextCursor: string | null;
  freshness: "fresh" | "degraded";
};

