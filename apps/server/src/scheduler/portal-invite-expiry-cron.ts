import cron, { type ScheduledTask } from "node-cron";

import { leaseTenantMembershipsDb } from "@/db/lease-tenant-memberships";

import { server } from "../server";

/** Hourly at minute 20 — mark pending portal invites past expires_at as expired. */
const PORTAL_INVITE_EXPIRY_CRON_SCHEDULE = "20 * * * *";

let task: ScheduledTask | null = null;

export function startPortalInviteExpiryCron(): void {
  if (process.env["NODE_ENV"] !== "production") {
    return;
  }

  task = cron.schedule(PORTAL_INVITE_EXPIRY_CRON_SCHEDULE, async () => {
    try {
      const expiredCount = await leaseTenantMembershipsDb.expirePendingPortalInvites();
      if (expiredCount > 0) {
        server.log.info(`[PortalInviteExpiryCron] Marked ${expiredCount} portal invite(s) expired`);
      }
    } catch (err) {
      console.error("[PortalInviteExpiryCron] Error expiring portal invites:", err);
    }
  });
}

export function stopPortalInviteExpiryCron(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
