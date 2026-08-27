import type { FillQuote, InstrumentModel, Reservation } from "../types";

const CHART_SCALE = 1_000_000n;

export type PriceChartPoint = {
  position: number;
  price: number;
};

export type AllocationSegment = {
  key: string;
  kind: "settled" | "reserved" | "open";
  label: string;
  value: number;
};

export type MeasurementInterval = {
  start: number;
  end: number;
};

export type InstrumentChartData = {
  pricePoints: [PriceChartPoint, PriceChartPoint];
  allocationSegments: AllocationSegment[];
  currentPosition: number;
  measurement?: MeasurementInterval;
};

export function normalizeQuantity(value: bigint, target: bigint) {
  if (target <= 0n || value <= 0n) return 0;
  if (value >= target) return 100;
  return Number((value * CHART_SCALE) / target) / Number(CHART_SCALE / 100n);
}

function normalizePrice(value: bigint, maximum: bigint) {
  if (maximum <= 0n || value <= 0n) return 10;
  return 10 + normalizeQuantity(value, maximum) * 0.8;
}

function buildPricePoints(model: InstrumentModel): [PriceChartPoint, PriceChartPoint] {
  const maximumPrice = model.startPrice > model.endPrice ? model.startPrice : model.endPrice;
  if (model.startPrice === model.endPrice) {
    return [
      { position: 0, price: 50 },
      { position: 100, price: 50 },
    ];
  }
  return [
    { position: 0, price: normalizePrice(model.startPrice, maximumPrice) },
    { position: 100, price: normalizePrice(model.endPrice, maximumPrice) },
  ];
}

function appendSegment(
  segments: AllocationSegment[],
  kind: AllocationSegment["kind"],
  label: string,
  start: bigint,
  end: bigint,
  target: bigint,
) {
  const value = normalizeQuantity(end, target) - normalizeQuantity(start, target);
  if (value <= 0) return;
  segments.push({ key: `segment_${segments.length}`, kind, label, value });
}

function buildAllocationSegments(model: InstrumentModel, reservations: Reservation[]) {
  const segments: AllocationSegment[] = [];
  appendSegment(segments, "settled", "SETTLED", 0n, model.settledQuantity, model.targetQuantity);

  if (model.reservedQuantity > 0n && reservations.length > 0) {
    let cursor = model.settledQuantity;
    const orderedReservations = reservations.toSorted((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    );
    for (const reservation of orderedReservations) {
      const end = cursor + reservation.quantity;
      appendSegment(
        segments,
        "reserved",
        `R${reservation.id.toString()}`,
        cursor,
        end,
        model.targetQuantity,
      );
      cursor = end;
    }
  } else {
    appendSegment(
      segments,
      "reserved",
      "RESERVED",
      model.settledQuantity,
      model.currentPosition,
      model.targetQuantity,
    );
  }

  appendSegment(
    segments,
    "open",
    "OPEN",
    model.currentPosition,
    model.targetQuantity,
    model.targetQuantity,
  );
  return segments;
}

function buildMeasurement(quote: FillQuote | undefined, target: bigint) {
  if (!quote) return undefined;
  return {
    start: normalizeQuantity(quote.startPosition, target),
    end: normalizeQuantity(quote.endPosition, target),
  };
}

export function buildInstrumentChartData(
  model: InstrumentModel,
  reservations: Reservation[],
  quote?: FillQuote,
): InstrumentChartData {
  return {
    pricePoints: buildPricePoints(model),
    allocationSegments: buildAllocationSegments(model, reservations),
    currentPosition: normalizeQuantity(model.currentPosition, model.targetQuantity),
    measurement: buildMeasurement(quote, model.targetQuantity),
  };
}
