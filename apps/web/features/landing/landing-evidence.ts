import { attestcoinEnvironment } from "../../../../config/attestcoin-environment";
import settlementEvidence from "../../../../artifacts/protocol/cc3-settlement-evidence.json";
import { formatUnits } from "viem";
import { z } from "zod";

const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const integer = z.string().regex(/^\d+$/);

export const landingEvidenceSchema = z.object({
  schemaVersion: z.literal("1"),
  verifiedAt: z.string().datetime(),
  chainId: z.number().int().positive(),
  reservationId: integer,
  foreignTransaction: hash,
  settlementTransaction: hash,
  replayIdentity: hash,
  solver: address,
  recipient: address,
  deliveredToken: address,
  deliveredAmount: integer,
  lockedPayout: integer,
  semanticChecks: z.object({
    officialVerification: z.literal("pass"),
    sourceChain: z.literal("pass"),
    sourceTiming: z.literal("pass"),
    directTransfer: z.literal("pass"),
    token: z.literal("pass"),
    sender: z.literal("pass"),
    recipient: z.literal("pass"),
    amount: z.literal("pass"),
    replayProtection: z.literal("pass"),
    reservationState: z.literal("settled"),
  }),
});

const checkLabels = {
  officialVerification: "Official verification",
  sourceChain: "Source chain",
  sourceTiming: "Delivery window",
  directTransfer: "Direct token transfer",
  token: "Approved token",
  sender: "Reserved solver",
  recipient: "Buyer wallet",
  amount: "Delivered amount",
  replayProtection: "Replay protection",
  reservationState: "Reservation state",
} as const;

export type LandingEvidence = {
  verifiedAt: string;
  reservationId: string;
  foreignNetwork: string;
  settlementNetwork: string;
  deliveryTokenSymbol: string;
  settlementTokenSymbol: string;
  deliveredAmount: string;
  payoutAmount: string;
  foreignTransaction: string;
  settlementTransaction: string;
  foreignExplorerUrl: string;
  settlementExplorerUrl: string;
  solver: string;
  recipient: string;
  deliveredToken: string;
  replayIdentity: string;
  semanticChecks: ReadonlyArray<{
    label: string;
    result: "Pass" | "Settled";
  }>;
};

export function buildExplorerUrl(baseUrl: string, transactionHash: string) {
  return `${baseUrl.replace(/\/$/, "")}/tx/${transactionHash}`;
}

export function formatEvidenceAmount(value: string, decimals: number) {
  const formatted = formatUnits(BigInt(value), decimals);
  const [whole, fraction = ""] = formatted.split(".");
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function parseLandingEvidence(input: unknown): LandingEvidence {
  const evidence = landingEvidenceSchema.parse(input);
  const semanticChecks = Object.entries(evidence.semanticChecks).map(
    ([key, result]) => ({
      label: checkLabels[key as keyof typeof checkLabels],
      result: result === "settled" ? ("Settled" as const) : ("Pass" as const),
    }),
  );

  return {
    verifiedAt: evidence.verifiedAt,
    reservationId: evidence.reservationId,
    foreignNetwork: attestcoinEnvironment.foreign.name,
    settlementNetwork: attestcoinEnvironment.creditcoin.name,
    deliveryTokenSymbol: attestcoinEnvironment.deliveryToken.symbol,
    settlementTokenSymbol: attestcoinEnvironment.settlementToken.symbol,
    deliveredAmount: formatEvidenceAmount(
      evidence.deliveredAmount,
      attestcoinEnvironment.deliveryToken.decimals,
    ),
    payoutAmount: formatEvidenceAmount(
      evidence.lockedPayout,
      attestcoinEnvironment.settlementToken.decimals,
    ),
    foreignTransaction: evidence.foreignTransaction,
    settlementTransaction: evidence.settlementTransaction,
    foreignExplorerUrl: buildExplorerUrl(
      attestcoinEnvironment.foreign.explorerUrl,
      evidence.foreignTransaction,
    ),
    settlementExplorerUrl: buildExplorerUrl(
      attestcoinEnvironment.creditcoin.explorerUrl,
      evidence.settlementTransaction,
    ),
    solver: evidence.solver,
    recipient: evidence.recipient,
    deliveredToken: evidence.deliveredToken,
    replayIdentity: evidence.replayIdentity,
    semanticChecks,
  };
}

export const landingEvidence = parseLandingEvidence(settlementEvidence);
