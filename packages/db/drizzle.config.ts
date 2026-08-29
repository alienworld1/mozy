import { config as loadEnvironment } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));

loadEnvironment({
  path: [`${workspaceRoot}.env.local`, `${workspaceRoot}.env`],
  quiet: true,
});

if (!process.env.DATABASE_MIGRATION_URL) {
  throw new Error("DATABASE_MIGRATION_URL is required for migrations");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: { url: process.env.DATABASE_MIGRATION_URL },
  schemaFilter: ["mozy"],
});
