import "dotenv/config";

import { verifyRedisConnection } from "@/queues/redis-connection";
import { reenqueueAllStuckPropertyExports } from "@/services/property-export/property-export-reenqueue";
import {
  startPropertyExportWorker,
  stopPropertyExportWorker,
} from "@/services/property-export-worker";

async function main(): Promise<void> {
  const redisOk = await verifyRedisConnection();
  if (!redisOk) {
    console.error("[property-export-worker] Redis connection failed; exiting.");
    process.exit(1);
  }

  const worker = startPropertyExportWorker();
  const reenqueuedCount = await reenqueueAllStuckPropertyExports();
  console.info("[property-export-worker] started", { reenqueuedCount });

  const shutdown = async (signal: string) => {
    console.info(`[property-export-worker] received ${signal}, shutting down`);
    await stopPropertyExportWorker();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  await worker.waitUntilReady();
}

void main().catch((error) => {
  console.error("[property-export-worker] fatal error", error);
  process.exit(1);
});
