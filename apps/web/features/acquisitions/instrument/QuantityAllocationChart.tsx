"use client";

import { Bar, BarChart, LabelList, ReferenceArea, ReferenceLine, XAxis, YAxis } from "recharts";
import type { AllocationSegment, MeasurementInterval } from "./instrument-chart-data";

const segmentStyles = {
  settled: {
    fill: "var(--wash-strong)",
    stroke: "var(--ink)",
    strokeDasharray: undefined,
  },
  reserved: {
    fill: "var(--wash)",
    stroke: "var(--line-emphasis)",
    strokeDasharray: "4 2",
  },
  open: {
    fill: "var(--paper-raised)",
    stroke: "var(--line-strong)",
    strokeDasharray: undefined,
  },
} as const;

export function QuantityAllocationChart({
  segments,
  currentPosition,
  measurement,
  animate,
}: {
  segments: AllocationSegment[];
  currentPosition: number;
  measurement?: MeasurementInterval;
  animate: boolean;
}) {
  const row: Record<string, string | number> = { name: "Quantity" };
  for (const segment of segments) row[segment.key] = segment.value;

  return (
    <div className="h-32 min-w-0 bg-paper-raised">
      <BarChart
        responsive
        accessibilityLayer
        title="Acquisition quantity allocation"
        desc="The target quantity divided into settled, reserved, and open regions. Exact values are listed below the chart."
        layout="vertical"
        data={[row]}
        barCategoryGap="28%"
        margin={{ top: 10, right: 10, bottom: 26, left: 10 }}
        style={{ width: "100%", height: "100%" }}
      >
        <XAxis
          type="number"
          domain={[0, 100]}
          ticks={[0, 100]}
          tickFormatter={(value: number) => value === 0 ? "0" : "TARGET"}
          axisLine={{ stroke: "var(--ink)", strokeWidth: 1 }}
          tickLine={{ stroke: "var(--ink)", strokeWidth: 1 }}
          tick={{ fill: "var(--ink-secondary)", fontSize: 10, fontFamily: "var(--font-ibm-plex-mono)" }}
        />
        <YAxis type="category" dataKey="name" hide />
        {segments.map((segment) => {
          const style = segmentStyles[segment.kind];
          const showLabel = segment.value >= (segment.kind === "reserved" ? 7 : 14);
          return (
            <Bar
              key={segment.key}
              dataKey={segment.key}
              stackId="allocation"
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={1.25}
              strokeDasharray={style.strokeDasharray}
              isAnimationActive={animate}
              animationDuration={260}
              animationEasing="ease-out"
            >
              {showLabel ? (
                <LabelList
                  dataKey={segment.key}
                  position="center"
                  formatter={() => segment.label}
                  fill="var(--ink)"
                  fontSize={10}
                  fontWeight={600}
                  fontFamily="var(--font-ibm-plex-mono)"
                />
              ) : null}
            </Bar>
          );
        })}
        {measurement ? (
          <ReferenceArea
            x1={measurement.start}
            x2={measurement.end}
            fill="var(--signal)"
            fillOpacity={0.12}
            stroke="var(--signal)"
            strokeWidth={1.5}
            ifOverflow="hidden"
            zIndex={500}
          />
        ) : null}
        <ReferenceLine
          x={currentPosition}
          stroke="var(--signal)"
          strokeWidth={1.75}
          ifOverflow="visible"
          zIndex={600}
        />
      </BarChart>
    </div>
  );
}
