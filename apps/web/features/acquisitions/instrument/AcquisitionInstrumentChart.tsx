"use client";

import { useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import type { FillQuote, InstrumentModel, Reservation } from "../types";
import { buildInstrumentChartData } from "./instrument-chart-data";
import { InstrumentStateSelector, type InstrumentRegion } from "./InstrumentStateSelector";
import { PriceCurveChart } from "./PriceCurveChart";
import { QuantityAllocationChart } from "./QuantityAllocationChart";

export function AcquisitionInstrumentChart({
  model,
  reservations,
  quote,
  transitionSnapshotConfirmed,
}: {
  model: InstrumentModel;
  reservations: Reservation[];
  quote?: FillQuote;
  transitionSnapshotConfirmed: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const [activeRegion, setActiveRegion] = useState<InstrumentRegion>("Open");
  const [animationState, setAnimationState] = useState({
    snapshotBlock: model.snapshotBlock,
    enabled: false,
  });
  const chartData = useMemo(
    () => buildInstrumentChartData(model, reservations, quote),
    [model, quote, reservations],
  );
  if (animationState.snapshotBlock !== model.snapshotBlock) {
    setAnimationState({
      snapshotBlock: model.snapshotBlock,
      enabled: transitionSnapshotConfirmed,
    });
  }
  const animate = animationState.enabled && !reducedMotion;

  return (
    <div>
      <PriceCurveChart
        points={chartData.pricePoints}
        currentPosition={chartData.currentPosition}
        measurement={chartData.measurement}
        animate={animate}
      />
      <div className="mt-4">
        <QuantityAllocationChart
          segments={chartData.allocationSegments}
          currentPosition={chartData.currentPosition}
          measurement={chartData.measurement}
          animate={animate}
        />
      </div>
      <InstrumentStateSelector
        model={model}
        activeRegion={activeRegion}
        onRegionChange={setActiveRegion}
      />
    </div>
  );
}
