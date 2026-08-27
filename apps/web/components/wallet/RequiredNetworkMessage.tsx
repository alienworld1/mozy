import { releaseConfig } from "@mozy/chain-config";

export function RequiredNetworkMessage({
  requiredChainId,
  currentChainId,
  switching = false,
  onSwitch,
}: {
  requiredChainId: number;
  currentChainId?: number;
  switching?: boolean;
  onSwitch: () => void;
}) {
  const network =
    requiredChainId === releaseConfig.creditcoin.id
      ? releaseConfig.creditcoin
      : requiredChainId === releaseConfig.foreign.id
        ? releaseConfig.foreign
        : undefined;
  if (!network || currentChainId === requiredChainId) return null;

  const shortName =
    requiredChainId === releaseConfig.creditcoin.id
      ? "Creditcoin"
      : "Ethereum Sepolia";

  return (
    <section className="border-l-2 border-signal bg-wash px-4 py-4">
      <p className="text-sm font-medium">{network.name} required</p>
      <p className="mt-1 text-sm text-ink-secondary">
        This action uses the {network.role.toLowerCase()}.
      </p>
      <button
        type="button"
        onClick={onSwitch}
        disabled={switching}
        className="mt-4 min-h-11 rounded-control bg-signal px-4 text-sm font-medium text-paper-raised outline-none hover:bg-signal-strong disabled:cursor-wait disabled:bg-line-emphasis focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
      >
        {switching ? "Waiting for wallet" : `Switch to ${shortName}`}
      </button>
    </section>
  );
}
