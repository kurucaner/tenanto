import cron, { type ScheduledTask } from "node-cron";

import { refreshTokenDb } from "@/db/refresh-tokens";

import { server } from "../server";

const CRON_SCHEDULE = "0 * * * *"; // Every hour at minute 0

let task: ScheduledTask | null = null;

export function startRefreshTokenCleanupCron(): void {
  if (process.env["NODE_ENV"] !== "production") {
    return;
  }

  task = cron.schedule(CRON_SCHEDULE, async () => {
    try {
      const deleted = await refreshTokenDb.deleteExpired();
      if (deleted > 0) {
        server.log.info(
          `[RefreshTokenCleanupCron] Deleted ${deleted} expired or revoked refresh token(s)`
        );
      }
    } catch (err) {
      console.error("[RefreshTokenCleanupCron] Error cleaning up refresh tokens:", err);
    }
  });
}

export function stopRefreshTokenCleanupCron(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
