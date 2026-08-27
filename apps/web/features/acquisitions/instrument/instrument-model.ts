import { parseUnits } from "viem";
import type { InstrumentModel, Mandate } from "../types";

export type MeasurementValidation =
  | { status: "empty" }
  | { status: "invalid"; message: string }
  | { status: "valid"; quantity: bigint };

export function buildInstrumentModel(
  mandate: Mandate,
  snapshotBlock: bigint,
): InstrumentModel | undefined {
  if (
    mandate.targetAmount <= 0n ||
    (mandate.pricingMode !== 0 && mandate.pricingMode !== 1) ||
    mandate.acquiredAmount < 0n ||
    mandate.reservedAmount < 0n ||
    mandate.acquiredAmount + mandate.reservedAmount > mandate.targetAmount
  ) {
    return undefined;
  }

  const currentPosition = mandate.acquiredAmount + mandate.reservedAmount;
  return {
    targetQuantity: mandate.targetAmount,
    settledQuantity: mandate.acquiredAmount,
    reservedQuantity: mandate.reservedAmount,
    openQuantity: mandate.targetAmount - currentPosition,
    currentPosition,
    pricingMode: mandate.pricingMode === 0 ? "Limit" : "Range",
    startPrice: mandate.startPrice,
    endPrice: mandate.endPrice,
    snapshotBlock,
  };
}

export function validateMeasurement(
  input: string,
  decimals: number,
  symbol: string,
  openQuantity: bigint,
  formattedOpenQuantity: string,
): MeasurementValidation {
  if (input === "") return { status: "empty" };
  if (!/^\d+(?:\.\d+)?$/.test(input)) {
    return { status: "invalid", message: `Enter a valid ${symbol} amount.` };
  }
  const fractionDigits = input.split(".")[1]?.length ?? 0;
  if (fractionDigits > decimals) {
    return {
      status: "invalid",
      message: `${symbol} supports up to ${decimals} decimal places.`,
    };
  }
  const quantity = parseUnits(input, decimals);
  if (quantity === 0n) {
    return { status: "invalid", message: "Enter an amount greater than zero." };
  }
  if (quantity > openQuantity) {
    return {
      status: "invalid",
      message: `Enter no more than ${formattedOpenQuantity} ${symbol}.`,
    };
  }
  return { status: "valid", quantity };
}
