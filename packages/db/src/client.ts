import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalDatabase = globalThis as typeof globalThis & {
  mozySql?: ReturnType<typeof postgres>;
};

export function getDatabase() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  const client =
    globalDatabase.mozySql ??
    postgres(connectionString, { prepare: false, max: 5 });
  globalDatabase.mozySql = client;
  return drizzle(client, { schema });
}

export async function closeDatabase() {
  await globalDatabase.mozySql?.end();
  globalDatabase.mozySql = undefined;
}

export type Database = ReturnType<typeof getDatabase>;
