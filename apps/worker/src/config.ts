import { hostname } from "node:os";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  CREDITCOIN_RPC_URL: z.string().url(),
  FOREIGN_RPC_URL: z.string().url(),
  ATTESTCOIN_PROOF_BUILDER_URL: z.string().url(),
  MOZY_RELAYER_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  MOZY_WORKER_ID: z.string().min(1).max(100).optional(),
});

export function workerConfig() {
  const value = schema.parse(process.env);
  return {
    ...value,
    MOZY_WORKER_ID:
      value.MOZY_WORKER_ID ?? `worker-${hostname()}-${process.pid}`,
  };
}
