import { releaseConfig } from "@mozy/chain-config";
import { closeDatabase, getDatabase, heartbeat } from "@mozy/db";
import { workerConfig } from "./config.js";
import { indexOnce } from "./indexer.js";
import { processOneJob } from "./proof-worker.js";
import { reconcileOnce } from "./reconciler.js";

const config = workerConfig();
let stopping = false;
process.once("SIGTERM", () => {
  stopping = true;
});
process.once("SIGINT", () => {
  stopping = true;
});

async function run() {
  try {
    let nextIndex = 0;
    let nextReconcile = 0;
    while (!stopping) {
      const now = Date.now();
      await heartbeat(
        getDatabase(),
        releaseConfig.configVersion,
        "worker",
      ).catch(() => undefined);
      if (now >= nextIndex) {
        await indexOnce(config).catch(() => 0);
        nextIndex = now + 15_000;
      }
      if (now >= nextReconcile) {
        await reconcileOnce(config).catch(() => 0);
        nextReconcile = now + 60_000;
      }
      const processed = await processOneJob(config).catch(() => false);
      if (!processed) await delay(5_000);
    }
  } finally {
    await closeDatabase();
  }
}

run().catch((error) => {
  process.stderr.write(
    `Mozy worker stopped: ${error instanceof Error ? error.message : "unknown error"}\n`,
  );
  process.exitCode = 1;
});

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
