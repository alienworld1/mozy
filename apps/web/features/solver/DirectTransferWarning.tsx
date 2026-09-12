import { releaseConfig } from "@mozy/chain-config";

export function DirectTransferWarning() {
  return (
    <aside
      className="border-l-2 border-pending bg-wash px-4 py-4"
      aria-labelledby="direct-transfer-warning-title"
    >
      <h3 id="direct-transfer-warning-title" className="text-sm font-medium">
        Direct transaction required
      </h3>
      <p className="mt-2 text-xs leading-5 text-ink-secondary">
        Turn off smart-account execution, batching, sponsored or gasless
        transactions, and paying gas with tokens. These features can route the
        transfer through another contract, which cannot be verified for
        settlement.
      </p>
      <p className="mt-2 text-xs leading-5 text-ink-secondary">
        Before approving, confirm your wallet is interacting directly with the
        {` ${releaseConfig.deliveryToken.symbol} `}
        contract:
      </p>
      <p className="mt-2 break-all font-mono text-[11px] text-ink">
        {releaseConfig.deliveryToken.address}
      </p>
      <p className="mt-2 text-xs leading-5 text-ink-secondary">
        If your wallet shows a different interaction target, cancel the
        transaction and switch back to standard transaction mode.
      </p>
    </aside>
  );
}
