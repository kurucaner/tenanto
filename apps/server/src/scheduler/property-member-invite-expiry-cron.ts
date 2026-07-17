import cron, { type ScheduledTask } from "node-cron";

import { propertyInvitesDb } from "@/db/property-invites";

import { server } from "../server";

/** Hourly at minute 25 — mark pending property member invites past expires_at as expired. */
const PROPERTY_MEMBER_INVITE_EXPIRY_CRON_SCHEDULE = "25 * * * *";

let task: ScheduledTask | null = null;

export function startPropertyMemberInviteExpiryCron(): void {
  if (process.env["NODE_ENV"] !== "production") {
    return;
  }

  task = cron.schedule(PROPERTY_MEMBER_INVITE_EXPIRY_CRON_SCHEDULE, async () => {
    try {
      const expiredCount = await propertyInvitesDb.expirePendingInvites();
      if (expiredCount > 0) {
        server.log.info(
          `[PropertyMemberInviteExpiryCron] Marked ${expiredCount} property invite(s) expired`
        );
      }
    } catch (err) {
      console.error("[PropertyMemberInviteExpiryCron] Error expiring property invites:", err);
    }
  });
}

export function stopPropertyMemberInviteExpiryCron(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
