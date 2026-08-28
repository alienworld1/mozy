import { releaseConfig } from "@mozy/chain-config";
import { formatTokenAmount } from "@/features/acquisitions/format";
import type { ReservationWorkspaceData } from "./useReservationWorkspace";
import { CopyableValue } from "./CopyableValue";

export function DeliverySpecification({
  data,
}: {
  data: ReservationWorkspaceData;
}) {
  const amount = `${formatTokenAmount(data.reservation.quantity, releaseConfig.deliveryToken.decimals)} ${releaseConfig.deliveryToken.symbol}`;
  return (
    <section
      className="border-y border-line py-8"
      aria-labelledby="delivery-specification-title"
    >
      <p className="font-mono text-[10px] tracking-wide text-ink-tertiary">
        DIRECT DELIVERY SPECIFICATION
      </p>
      <h2
        id="delivery-specification-title"
        className="mt-2 text-2xl font-medium"
      >
        Send {amount} directly to the buyer
      </h2>
      <ol className="mt-7 grid gap-5 text-sm leading-6 sm:grid-cols-2">
        <li className="border-l-2 border-signal pl-4">
          <span className="block font-medium">
            Deliver the approved {releaseConfig.deliveryToken.symbol} token.
          </span>
          <span className="text-ink-secondary">
            No Mozy contract receives the asset.
          </span>
        </li>
        <li className="border-l-2 border-line-strong pl-4">
          <span className="block font-medium">
            Send from the reserved solver wallet.
          </span>
          <span className="text-ink-secondary">
            Use the same address on both networks.
          </span>
        </li>
        <li className="border-l-2 border-line-strong pl-4">
          <span className="block font-medium">
            Send directly to the shown delivery wallet.
          </span>
          <span className="text-ink-secondary">
            The recipient is fixed by M{data.reservation.mandateId.toString()}.
          </span>
        </li>
        <li className="border-l-2 border-line-strong pl-4">
          <span className="block font-medium">
            Submit within the reservation window.
          </span>
          <span className="text-ink-secondary">
            The canonical deadline remains authoritative.
          </span>
        </li>
      </ol>
      <div
        className="mt-8 bg-wash px-4 py-5"
        aria-label="Transaction to inspect before signing"
      >
        <h3 className="text-sm font-medium">Transaction you will sign</h3>
        <dl className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-ink-tertiary">Contract</dt>
            <dd className="mt-1 font-mono text-xs">
              {releaseConfig.deliveryToken.symbol} ·{" "}
              {releaseConfig.deliveryToken.address.slice(0, 10)}…
              {releaseConfig.deliveryToken.address.slice(-8)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-tertiary">Method</dt>
            <dd className="mt-1 font-mono text-xs">
              transfer(address,uint256)
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-tertiary">From</dt>
            <dd
              className="mt-1 truncate font-mono text-xs"
              title={data.reservation.solver}
            >
              {data.reservation.solver}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-tertiary">Recipient</dt>
            <dd
              className="mt-1 truncate font-mono text-xs"
              title={data.requirements.deliveryWallet}
            >
              {data.requirements.deliveryWallet}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-tertiary">Amount</dt>
            <dd className="mt-1 font-mono text-xs tabular-nums">{amount}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-tertiary">Network</dt>
            <dd className="mt-1 text-xs">{releaseConfig.foreign.name}</dd>
          </div>
        </dl>
      </div>
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <CopyableValue
          label="Token contract"
          value={data.requirements.market.foreignToken}
        />
        <CopyableValue
          label="Delivery wallet"
          value={data.requirements.deliveryWallet}
        />
        <CopyableValue
          label="Reserved solver"
          value={data.reservation.solver}
        />
        <CopyableValue
          label="Reservation ID"
          value={`R${data.reservation.id.toString()}`}
        />
      </div>
    </section>
  );
}
