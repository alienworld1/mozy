import { RiExternalLinkLine } from "react-icons/ri";
import { CopyableValue } from "@/features/solver/CopyableValue";
import { formatTokenAmount } from "@/features/acquisitions/format";
import type { DeliveryReceipt } from "./types";

export function ReceiptTechnicalDisclosure({ receipt }: { receipt: DeliveryReceipt }) {
  const copyableFields = [
    ["Token contract", receipt.foreign.tokenAddress],
    ["Sender", receipt.foreign.sender],
    ["Recipient", receipt.foreign.recipient],
    ["Source position", `${receipt.foreign.blockHeight} / ${receipt.foreign.transactionIndex} / ${receipt.foreign.transferLogIndex}`],
    ["Replay identity", receipt.verification.replayIdentity],
    ["Relayer", receipt.creditcoin.relayer],
    ["Payout recipient", receipt.creditcoin.payoutRecipient],
    ["Acquisition Mandate", `M${receipt.mandateId}`],
    ["Fill Reservation", `R${receipt.reservationId}`],
  ] as const;
  return (
    <details className="mt-10 border-y border-line py-5">
      <summary className="min-h-11 cursor-pointer content-center text-sm font-medium outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">Technical proof details</summary>
      <div className="mt-6 border-t border-line pt-6">
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <div><dt className="text-xs text-ink-tertiary">Source chain</dt><dd className="mt-1 font-mono text-xs">{receipt.foreign.chainName} · {receipt.foreign.chainId}</dd></div>
          <div><dt className="text-xs text-ink-tertiary">Settlement chain</dt><dd className="mt-1 font-mono text-xs">{receipt.creditcoin.chainName} · {receipt.creditcoin.chainId}</dd></div>
          <div><dt className="text-xs text-ink-tertiary">Source chain key</dt><dd className="mt-1 font-mono text-xs">{receipt.foreign.sourceChainKey}</dd></div>
          <div><dt className="text-xs text-ink-tertiary">Proof status</dt><dd className="mt-1 text-sm font-medium">Verified</dd></div>
          <div><dt className="text-xs text-ink-tertiary">Replay status</dt><dd className="mt-1 text-sm font-medium">Consumed</dd></div>
          <div><dt className="text-xs text-ink-tertiary">Attestcoin version</dt><dd className="mt-1 font-mono text-xs">{receipt.verification.version ?? "Version unavailable"}</dd></div>
          <div><dt className="text-xs text-ink-tertiary">Payout and bond</dt><dd className="mt-1 font-mono text-xs">{formatTokenAmount(BigInt(receipt.creditcoin.payoutAmount), receipt.creditcoin.payoutTokenDecimals)} + {formatTokenAmount(BigInt(receipt.creditcoin.returnedBond), receipt.creditcoin.payoutTokenDecimals)} {receipt.creditcoin.payoutTokenSymbol}</dd></div>
        </dl>
        <div className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {copyableFields.map(([label, value]) => <CopyableValue key={label} label={label} value={value} />)}
          {receipt.foreign.transactionTo ? <CopyableValue label="Transaction target" value={receipt.foreign.transactionTo} /> : null}
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="min-w-0 border-t border-line pt-4">
            <CopyableValue label="Foreign transaction hash" value={receipt.foreign.transactionHash} />
            <a href={receipt.foreign.explorerUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal">View foreign delivery transaction <RiExternalLinkLine aria-hidden="true" /></a>
          </div>
          <div className="min-w-0 border-t border-line pt-4">
            <CopyableValue label="Creditcoin settlement hash" value={receipt.creditcoin.transactionHash} />
            <a href={receipt.creditcoin.explorerUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal">View Creditcoin settlement transaction <RiExternalLinkLine aria-hidden="true" /></a>
          </div>
        </div>
      </div>
    </details>
  );
}
