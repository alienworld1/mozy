import { releaseConfig } from "@mozy/chain-config";
import { IoOpenOutline } from "react-icons/io5";
import type { Mandate } from "./types";

export function TechnicalDisclosure({ mandate }: { mandate: Mandate }) {
  const explorer = releaseConfig.creditcoin.blockExplorers.default.url;
  const details = [["Mandate ID", mandate.id.toString()], ["Market ID", mandate.marketId.toString()], ["Buyer", mandate.buyer], ["Delivery wallet", mandate.deliveryWallet], ["Delivery token", releaseConfig.deliveryToken.address], ["Settlement token", releaseConfig.settlementToken.address], ["Market contract", releaseConfig.contracts.market], ["Settlement vault", releaseConfig.contracts.vault]];
  return <details className="mt-12 border-y border-line py-5"><summary className="min-h-11 cursor-pointer content-center font-medium outline-none focus-visible:outline-2 focus-visible:outline-signal">Technical details</summary><dl className="mt-4 divide-y divide-line text-sm">{details.map(([label, value]) => <div key={label} className="grid gap-1 py-3 sm:grid-cols-[180px_1fr]"><dt className="text-ink-secondary">{label}</dt><dd className="min-w-0 break-all font-mono text-xs">{value}</dd></div>)}</dl><a href={`${explorer}/address/${releaseConfig.contracts.market}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal">Open market contract <IoOpenOutline aria-hidden="true" /></a></details>;
}
