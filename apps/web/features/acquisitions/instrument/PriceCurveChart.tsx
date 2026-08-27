"use client";

import { Line, LineChart, ReferenceArea, ReferenceLine, XAxis, YAxis } from "recharts";
import type { MeasurementInterval, PriceChartPoint } from "./instrument-chart-data";

export function PriceCurveChart({
  points,
  currentPosition,
  measurement,
  animate,
}: {
  points: [PriceChartPoint, PriceChartPoint];
  currentPosition: number;
  measurement?: MeasurementInterval;
  animate: boolean;
}) {
  return (
    <div className="h-40 min-w-0 border-y border-line bg-paper-raised sm:h-44">
      <LineChart
        responsive
        accessibilityLayer
        title="Mandate price rule"
        desc="The configured price rule across the full target quantity. Exact endpoint prices are listed above the chart."
        data={points}
        margin={{ top: 24, right: 10, bottom: 18, left: 10 }}
        style={{ width: "100%", height: "100%" }}
      >
        <XAxis type="number" dataKey="position" domain={[0, 100]} hide />
        <YAxis type="number" dataKey="price" domain={[0, 100]} hide />
        {measurement ? (
          <ReferenceArea
            x1={measurement.start}
            x2={measurement.end}
            y1={0}
            y2={100}
            fill="var(--signal)"
            fillOpacity={0.08}
            stroke="var(--signal)"
            strokeOpacity={0.55}
            strokeWidth={1}
            ifOverflow="hidden"
            zIndex={100}
          />
        ) : null}
        <ReferenceLine
          x={currentPosition}
          stroke="var(--signal)"
          strokeWidth={1.5}
          ifOverflow="visible"
          zIndex={200}
        />
        <Line
          type="linear"
          dataKey="price"
          stroke="var(--ink)"
          strokeWidth={2}
          dot={{ r: 3.5, fill: "var(--paper-raised)", stroke: "var(--ink)", strokeWidth: 2 }}
          activeDot={false}
          isAnimationActive={animate}
          animationDuration={260}
          animationEasing="ease-out"
        />
      </LineChart>
    </div>
  );
}
