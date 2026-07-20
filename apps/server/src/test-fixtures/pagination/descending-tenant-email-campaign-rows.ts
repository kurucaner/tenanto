import { testDateTime } from "../dates";
import { buildTenantEmailCampaignRow } from "../db-rows/tenant-email-campaign-row";
import { sequentialUuid } from "../ids";

const CAMPAIGN_SPECS = [
  {
    failedCount: 0,
    recipientCount: 10,
    sentCount: 10,
    status: "completed",
    subject: "Rent reminder July",
  },
  {
    failedCount: 0,
    recipientCount: 5,
    sentCount: 5,
    status: "completed",
    subject: "Welcome notice",
  },
  {
    failedCount: 1,
    recipientCount: 8,
    sentCount: 7,
    status: "completed_with_errors",
    subject: "Maintenance update",
  },
] as const;

export function buildDescendingTenantEmailCampaignRows(): Record<string, unknown>[] {
  return CAMPAIGN_SPECS.map((spec, rowIndex) => {
    const dayOffset = -rowIndex;

    return buildTenantEmailCampaignRow({
      created_at: testDateTime(dayOffset),
      failed_count: spec.failedCount,
      id: sequentialUuid(rowIndex + 1),
      idempotency_key: `key-${rowIndex + 1}`,
      recipient_count: spec.recipientCount,
      sent_count: spec.sentCount,
      status: spec.status,
      subject: spec.subject,
      updated_at: testDateTime(dayOffset),
    });
  });
}
