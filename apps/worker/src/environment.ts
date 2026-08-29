import { config as loadEnvironment } from "dotenv";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../../../", import.meta.url));

export function loadWorkerEnvironment() {
  loadEnvironment({
    path: [`${workspaceRoot}.env.local`, `${workspaceRoot}.env`],
    quiet: true,
  });
}
