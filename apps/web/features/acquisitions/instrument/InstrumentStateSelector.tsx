"use client";

import { releaseConfig } from "@mozy/chain-config";
import { formatExactTokenAmount } from "../format";
import type { InstrumentModel } from "../types";

export type InstrumentRegion = "Settled" | "Reserved" | "Open";

export function InstrumentStateSelector({
  model,
  activeRegion,
  onRegionChange,
}: {
  model: InstrumentModel;
  activeRegion: InstrumentRegion;
  onRegionChange: (region: InstrumentRegion) => void;
}) {
  const regions = [
    { name: "Settled" as const, value: model.settledQuantity },
    { name: "Reserved" as const, value: model.reservedQuantity },
    { name: "Open" as const, value: model.openQuantity },
  ];
  const activeValue = regions.find((region) => region.name === activeRegion)?.value ?? 0n;

  let description = `${activeRegion} accounts for ${formatExactTokenAmount(activeValue, releaseConfig.deliveryToken.decimals)} ${releaseConfig.deliveryToken.symbol}.`;
  if (activeRegion === "Settled" && activeValue === 0n) description = "Nothing settled yet.";
  if (activeRegion === "Reserved" && activeValue === 0n) description = "No active reservations.";
  if (activeRegion === "Open" && activeValue === 0n) description = "No quantity remains open.";

  return (
    <div>
      <div className="grid grid-cols-3 border-y border-line text-xs">
        {regions.map((region) => (
          <button
            key={region.name}
            type="button"
            onFocus={() => onRegionChange(region.name)}
            onClick={() => onRegionChange(region.name)}
            aria-pressed={activeRegion === region.name}
            className={`min-h-11 min-w-0 px-2 py-2 text-left outline-none focus-visible:outline-2 focus-visible:outline-signal ${activeRegion === region.name ? "bg-wash" : ""}`}
          >
            <span className="block font-mono text-[10px] font-medium tracking-wide text-ink-secondary">
              {region.name.toUpperCase()}
            </span>
            <span className="mt-1 block break-words tabular-nums">
              {formatExactTokenAmount(region.value, releaseConfig.deliveryToken.decimals)} {releaseConfig.deliveryToken.symbol}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 min-h-5 text-sm text-ink-secondary" aria-live="polite">
        {description}
      </p>
    </div>
  );
}
