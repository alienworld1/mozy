export const MAX_TARGET_AMOUNT = 10n ** 24n;
export const MAX_PRICE = 10n ** 24n;

export type PricingMode = "limit" | "range";

export interface QuoteInput {
  mode: PricingMode;
  target: bigint;
  foreignTokenDecimals: number;
  startPrice: bigint;
  endPrice: bigint;
  startPosition: bigint;
  quantity: bigint;
}

export function referenceQuote(input: QuoteInput): bigint {
  const { mode, target, foreignTokenDecimals, startPrice, endPrice, startPosition, quantity } = input;
  if (target <= 0n || target > MAX_TARGET_AMOUNT) throw new RangeError("target outside supported range");
  if (startPrice <= 0n || endPrice <= 0n || startPrice > MAX_PRICE || endPrice > MAX_PRICE) {
    throw new RangeError("price outside supported range");
  }
  if (!Number.isInteger(foreignTokenDecimals) || foreignTokenDecimals < 0 || foreignTokenDecimals > 18) {
    throw new RangeError("decimals outside supported range");
  }
  if (mode === "limit" && startPrice !== endPrice) throw new RangeError("limit endpoints differ");
  if (quantity <= 0n) throw new RangeError("quantity must be positive");
  if (startPosition < 0n || startPosition > target || quantity > target - startPosition) {
    throw new RangeError("interval exceeds target");
  }

  const unit = 10n ** BigInt(foreignTokenDecimals);
  let payout: bigint;
  if (mode === "limit" || startPrice === endPrice) {
    payout = (startPrice * quantity) / unit;
  } else {
    const difference = endPrice - startPrice;
    const numerator =
      2n * startPrice * target * quantity + difference * quantity * (2n * startPosition + quantity);
    payout = numerator / (2n * target * unit);
  }
  if (payout === 0n) throw new RangeError("quote rounds to zero");
  return payout;
}
