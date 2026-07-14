import cron, { type ScheduledTask } from "node-cron";

import { PROPERTY_EXPORT_EXPIRY_CRON_SCHEDULE } from "@/lib/property-export-config";
import { expireCompletedPropertyExports } from "@/services/property-export/property-export-maintenance";

import { server } from "../server";

let task: ScheduledTask | null = null;

export function startPropertyExportExpiryCron(): void {
  if (process.env["NODE_ENV"] !== "production") {
    return;
  }

  task = cron.schedule(PROPERTY_EXPORT_EXPIRY_CRON_SCHEDULE, async () => {
    try {
      const expiredCount = await expireCompletedPropertyExports();
      if (expiredCount > 0) {
        server.log.info(`[PropertyExportExpiryCron] Marked ${expiredCount} export job(s) expired`);
      }
    } catch (err) {
      console.error("[PropertyExportExpiryCron] Error expiring export jobs:", err);
    }
  });
}

export function stopPropertyExportExpiryCron(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
