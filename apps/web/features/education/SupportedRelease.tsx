import { releaseConfig } from "@mozy/chain-config";
import { CopyableValue } from "@/features/solver/CopyableValue";
import { knownLimitations } from "./content";

function releaseFact(label: string, value: string) {
  return (
    <div className="grid gap-1 border-b border-line py-4 sm:grid-cols-[180px_1fr] sm:gap-6">
      <dt className="text-xs text-ink-tertiary">{label}</dt>
      <dd className="font-mono text-xs leading-5">{value}</dd>
    </div>
  );
}

export function SupportedRelease() {
  const bondPercent =
    Number(releaseConfig.bondPolicy.rateBps) /
    Number(releaseConfig.bondPolicy.denominator / 100n);
  const bondCap =
    releaseConfig.bondPolicy.cap /
    10n ** BigInt(releaseConfig.settlementToken.decimals);

  return (
    <section
      id="supported-release"
      aria-labelledby="supported-release-title"
      className="scroll-mt-8"
    >
      <div className="max-w-3xl">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-tertiary">
          Supported release
        </p>
        <h2
          id="supported-release-title"
          className="mt-3 text-[24px] font-medium"
        >
          One pinned testnet market
        </h2>
        <p className="mt-4 text-[15px] leading-6 text-ink-secondary">
          These facts come from the validated release configuration and current
          deployment artifact.
        </p>
        <dl className="mt-6 border-t border-line">
          {releaseFact(
            "Settlement",
            `${releaseConfig.creditcoin.name} · chain ${releaseConfig.creditcoin.id}`,
          )}
          {releaseFact(
            "Delivery",
            `${releaseConfig.foreign.name} · chain ${releaseConfig.foreign.id}`,
          )}
          {releaseFact(
            "Market",
            `M${releaseConfig.marketId} · ${releaseConfig.deliveryToken.symbol} (${releaseConfig.deliveryToken.decimals} decimals) → ${releaseConfig.settlementToken.symbol} (${releaseConfig.settlementToken.decimals} decimals)`,
          )}
          {releaseFact(
            "Reservation bond",
            `${bondPercent}% of locked payout · capped at ${bondCap.toString()} ${releaseConfig.settlementToken.symbol}`,
          )}
          {releaseFact(
            "Source policy",
            `${releaseConfig.sourceWindowPolicy.acceptedBlocks.toString()} accepted blocks · ${releaseConfig.sourceWindowPolicy.settlementGraceBlocks.toString()} grace blocks · inclusive bounds`,
          )}
        </dl>
      </div>
      <details className="mt-8 max-w-3xl border-y border-line py-4">
        <summary className="min-h-11 cursor-pointer content-center text-sm font-medium outline-none focus-visible:outline-2 focus-visible:outline-signal">
          Contract and token addresses
        </summary>
        <div className="mt-4 space-y-4">
          <CopyableValue
            label={`${releaseConfig.deliveryToken.symbol} token`}
            value={releaseConfig.deliveryToken.address}
          />
          <CopyableValue
            label={`${releaseConfig.settlementToken.symbol} token`}
            value={releaseConfig.settlementToken.address}
          />
          <CopyableValue
            label="Mozy settlement"
            value={releaseConfig.contracts.settlement}
          />
          <CopyableValue
            label="Configuration"
            value={releaseConfig.configVersion}
          />
        </div>
      </details>
      <div className="mt-10 max-w-3xl">
        <h3 className="text-lg font-medium">Known limitations</h3>
        <ul className="mt-4 border-t border-line">
          {knownLimitations.map((limitation) => (
            <li
              key={limitation}
              className="border-b border-line py-4 text-sm leading-6 text-ink-secondary"
            >
              {limitation}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
