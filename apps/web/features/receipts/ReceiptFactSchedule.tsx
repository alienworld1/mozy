import { formatTokenAmount } from "@/features/acquisitions/format";
import type { DeliveryReceipt } from "./types";

export function ReceiptFactSchedule({ receipt }: { receipt: DeliveryReceipt }) {
  const observed = formatTokenAmount(BigInt(receipt.foreign.observedAmount), receipt.foreign.tokenDecimals);
  const credited = formatTokenAmount(BigInt(receipt.foreign.creditedAmount), receipt.foreign.tokenDecimals);
  const payout = formatTokenAmount(BigInt(receipt.creditcoin.payoutAmount), receipt.creditcoin.payoutTokenDecimals);
  const bond = formatTokenAmount(BigInt(receipt.creditcoin.returnedBond), receipt.creditcoin.payoutTokenDecimals);
  const overdelivered = BigInt(receipt.foreign.observedAmount) > BigInt(receipt.foreign.creditedAmount);
  const facts = [
    ["Observed delivery", `${observed} ${receipt.foreign.tokenSymbol}`],
    ["Credited to reservation", `${credited} ${receipt.foreign.tokenSymbol}`],
    ["Solver payout", `${payout} ${receipt.creditcoin.payoutTokenSymbol}`],
    ["Bond returned", `${bond} ${receipt.creditcoin.payoutTokenSymbol}`],
  ];
  return (
    <section className="mt-10" aria-labelledby="receipt-facts-title">
      <h2 id="receipt-facts-title" className="text-xl font-medium">Receipt facts</h2>
      <dl className="mt-5 grid border-t border-line sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="border-b border-line py-5 sm:odd:pr-8 sm:even:border-l sm:even:pl-8">
            <dt className="text-xs text-ink-tertiary">{label}</dt>
            <dd className="mt-2 font-mono text-lg tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 max-w-3xl text-sm leading-6 text-ink-secondary">
        {overdelivered
          ? `The transfer delivered ${observed} ${receipt.foreign.tokenSymbol}; this reservation credited ${credited} ${receipt.foreign.tokenSymbol}. The extra amount did not increase the locked payout.`
          : "The verified transfer matched the reserved quantity."}
      </p>
    </section>
  );
}

