import { getAddress, isAddress, parseUnits, zeroAddress } from "viem";
import { releaseConfig } from "@mozy/chain-config";
import type { ParsedAcquisitionTerms, PricingMode } from "./types";

export type AcquisitionDraft = {
  target: string;
  pricingMode: PricingMode;
  limitPrice: string;
  startPrice: string;
  endPrice: string;
  deliveryWallet: string;
  expiry: string;
  durationHours: string;
  durationMinutes: string;
};

export type AcquisitionErrors = Partial<Record<keyof AcquisitionDraft, string>>;

const decimalPattern = /^\d+(?:\.\d+)?$/;

function parseAmount(value: string, symbol: "TEST" | "BTKT", tokenDecimals: number) {
  const trimmed = value.trim();
  if (!decimalPattern.test(trimmed)) throw new Error("missing");
  const decimals = trimmed.split(".")[1]?.length ?? 0;
  if (decimals > tokenDecimals) throw new Error(`${symbol} supports up to ${tokenDecimals} decimal places.`);
  const parsed = parseUnits(trimmed, tokenDecimals);
  if (parsed <= 0n) throw new Error("missing");
  return parsed;
}

export function validateAcquisitionDraft(draft: AcquisitionDraft): {
  errors: AcquisitionErrors;
  terms?: ParsedAcquisitionTerms;
} {
  const errors: AcquisitionErrors = {};
  let targetAmount: bigint | undefined;
  let startPrice: bigint | undefined;
  let endPrice: bigint | undefined;
  let deliveryWallet: `0x${string}` | undefined;
  let mandateExpiry: bigint | undefined;
  let reservationDuration: bigint | undefined;

  try { targetAmount = parseAmount(draft.target, "TEST", releaseConfig.deliveryToken.decimals); } catch (error) {
    errors.target = error instanceof Error && error.message.includes("decimals") ? error.message : "Enter a target quantity greater than zero.";
  }
  const priceFields = draft.pricingMode === "Limit" ? ["limitPrice"] as const : ["startPrice", "endPrice"] as const;
  for (const field of priceFields) {
    try {
      const amount = parseAmount(draft[field], "BTKT", releaseConfig.settlementToken.decimals);
      if (field === "endPrice") endPrice = amount;
      else startPrice = amount;
    } catch (error) {
      errors[field] = error instanceof Error && error.message.includes("decimals") ? error.message : "Enter a price greater than zero.";
    }
  }
  if (draft.pricingMode === "Limit" && startPrice) endPrice = startPrice;

  if (!isAddress(draft.deliveryWallet)) errors.deliveryWallet = "Enter a valid delivery wallet address.";
  else if (getAddress(draft.deliveryWallet) === zeroAddress) errors.deliveryWallet = "The delivery wallet cannot be the zero address.";
  else deliveryWallet = getAddress(draft.deliveryWallet);

  const expiryMs = new Date(draft.expiry).getTime();
  if (!draft.expiry || !Number.isFinite(expiryMs) || expiryMs <= Date.now()) errors.expiry = "Choose an expiry in the future.";
  else mandateExpiry = BigInt(Math.floor(expiryMs / 1000));

  const hours = /^\d+$/.test(draft.durationHours || "0") ? BigInt(draft.durationHours || "0") : -1n;
  const minutes = /^\d+$/.test(draft.durationMinutes || "0") ? BigInt(draft.durationMinutes || "0") : -1n;
  if (hours < 0n || minutes < 0n || minutes > 59n || hours * 3600n + minutes * 60n <= 0n) {
    errors.durationHours = "Enter a reservation duration greater than zero.";
  } else {
    reservationDuration = hours * 3600n + minutes * 60n;
    if (mandateExpiry && reservationDuration > mandateExpiry - BigInt(Math.floor(Date.now() / 1000))) {
      errors.durationHours = "Reservation duration must fit before the acquisition expires.";
    }
  }

  if (Object.keys(errors).length || !targetAmount || !startPrice || !endPrice || !deliveryWallet || !mandateExpiry || !reservationDuration) return { errors };
  return { errors, terms: { deliveryWallet, targetAmount, pricingMode: draft.pricingMode === "Limit" ? 0 : 1, startPrice, endPrice, mandateExpiry, reservationDuration } };
}
