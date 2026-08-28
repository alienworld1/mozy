import { getAddress, isAddress } from "viem";
import { z } from "zod";

export const transactionHashSchema = z
  .string()
  .regex(
    /^0x[0-9a-fA-F]{64}$/,
    "Enter a complete Ethereum Sepolia transaction hash.",
  );
const addressSchema = z
  .string()
  .refine(isAddress, "Invalid wallet address")
  .transform((value) => getAddress(value));
const signatureSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{130}$/, "Invalid wallet signature");
const isoTimestampSchema = z.string().datetime({ offset: true });

export const candidateRegistrationSchema = z
  .object({
    configVersion: z.string().min(1).max(100),
    reservationId: z.string().regex(/^[1-9]\d*$/),
    solver: addressSchema,
    foreignChainId: z.number().int().positive(),
    transactionHash: transactionHashSchema,
    source: z.enum(["composer", "external"]),
    issuedAt: isoTimestampSchema,
    expiresAt: isoTimestampSchema,
    origin: z.string().url().max(300),
    replacesHash: transactionHashSchema.optional(),
    signature: signatureSchema,
  })
  .strict();

export type CandidateRegistration = z.infer<typeof candidateRegistrationSchema>;
export type UnsignedCandidateRegistration = Omit<
  CandidateRegistration,
  "signature"
>;

export const candidateRecordSchema = z
  .object({
    configVersion: z.string(),
    reservationId: z.string(),
    solver: addressSchema,
    foreignChainId: z.number().int().positive(),
    transactionHash: transactionHashSchema,
    source: z.enum(["composer", "external"]),
    localState: z.enum([
      "submitted",
      "confirmed",
      "failed",
      "registered",
      "replaced",
      "registration_rejected",
    ]),
    submittedAt: isoTimestampSchema,
    replacesHash: transactionHashSchema.optional(),
    receiptBlockNumber: z.string().regex(/^\d+$/).optional(),
    failureMessage: z.string().max(120).optional(),
  })
  .strict();

export type CandidateRecord = z.infer<typeof candidateRecordSchema>;

export function buildRegistrationStatement(
  input: UnsignedCandidateRegistration,
) {
  return [
    "Mozy delivery transaction registration",
    `Origin: ${input.origin}`,
    `Configuration: ${input.configVersion}`,
    `Reservation: R${input.reservationId}`,
    `Solver: ${getAddress(input.solver)}`,
    `Foreign chain ID: ${input.foreignChainId}`,
    `Transaction: ${input.transactionHash.toLowerCase()}`,
    `Source: ${input.source}`,
    `Issued at: ${input.issuedAt}`,
    `Expires at: ${input.expiresAt}`,
    `Replaces: ${input.replacesHash?.toLowerCase() ?? "none"}`,
    "This signature only associates a candidate transaction. It does not verify delivery or release payment.",
  ].join("\n");
}

export function candidateStorageKey(
  configVersion: string,
  reservationId: string,
  solver: string,
) {
  return `mozy.candidates.v1:${configVersion}:${reservationId}:${getAddress(solver).toLowerCase()}`;
}

export function parseCandidateRecords(value: string | null) {
  if (!value) return [];
  try {
    const parsed = z
      .array(candidateRecordSchema)
      .max(8)
      .safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function mergeCandidateRecord(
  records: CandidateRecord[],
  next: CandidateRecord,
) {
  const normalizedHash = next.transactionHash.toLowerCase();
  const existing = records.find(
    (record) => record.transactionHash.toLowerCase() === normalizedHash,
  );
  if (existing)
    return records
      .map((record) =>
        record.transactionHash.toLowerCase() === normalizedHash
          ? { ...record, ...next }
          : record,
      )
      .slice(-8);
  const replaced = next.replacesHash
    ? records.map((record) =>
        record.transactionHash.toLowerCase() ===
        next.replacesHash?.toLowerCase()
          ? { ...record, localState: "replaced" as const }
          : record,
      )
    : records;
  return [...replaced, next].slice(-8);
}
