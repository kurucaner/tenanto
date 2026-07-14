import "dotenv/config";

import { verifyRedisConnection } from "@/queues/redis-connection";
import { reenqueueAllStuckTenantEmailCampaigns } from "@/services/tenant-email-campaign-reenqueue";
import {
  startTenantEmailSendWorker,
  stopTenantEmailSendWorker,
} from "@/services/tenant-email-send-worker";

async function main(): Promise<void> {
  const redisOk = await verifyRedisConnection();
  if (!redisOk) {
    console.error("[tenant-email-worker] Redis connection failed; exiting.");
    process.exit(1);
  }

  const worker = startTenantEmailSendWorker();
  const reenqueuedCount = await reenqueueAllStuckTenantEmailCampaigns();
  console.info("[tenant-email-worker] started", { reenqueuedCount });

  const shutdown = async (signal: string) => {
    console.info(`[tenant-email-worker] received ${signal}, shutting down`);
    await stopTenantEmailSendWorker();
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
  console.error("[tenant-email-worker] fatal error", error);
  process.exit(1);
});
