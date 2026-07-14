import { describe, expect, test } from "bun:test";

import {
  type ITenantEmailCampaignRecipient,
  TenantEmailCampaignStatus,
  TenantEmailRecipientStatus,
} from "@/packages/shared";

import {
  compareTenantEmailCampaignRecipients,
  getTenantEmailCampaignProcessedCount,
  isTenantEmailCampaignInProgress,
  isTenantEmailCampaignTerminal,
} from "./tenant-email-campaign-utils";

function createRecipient(
  overrides: Partial<ITenantEmailCampaignRecipient> & Pick<ITenantEmailCampaignRecipient, "id">
): ITenantEmailCampaignRecipient {
  return {
    attempts: 0,
    campaignId: "campaign-1",
    email: "tenant@example.com",
    lastError: null,
    leaseId: "lease-1",
    sentAt: null,
    status: TenantEmailRecipientStatus.SENT,
    tenantName: "Tenant",
    tenantRole: "primary",
    ...overrides,
  };
}

describe("tenant-email-campaign-utils", () => {
  test("detects in-progress and terminal statuses", () => {
    expect(isTenantEmailCampaignInProgress(TenantEmailCampaignStatus.SENDING)).toBe(true);
    expect(isTenantEmailCampaignTerminal(TenantEmailCampaignStatus.COMPLETED)).toBe(true);
    expect(isTenantEmailCampaignTerminal(TenantEmailCampaignStatus.SENDING)).toBe(false);
  });

  test("sums processed recipient counts", () => {
    expect(
      getTenantEmailCampaignProcessedCount({
        failedCount: 1,
        sentCount: 2,
        skippedCount: 3,
      })
    ).toBe(6);
  });

  test("sorts failed recipients before skipped and sent, then by tenant name", () => {
    const failed = createRecipient({
      id: "failed",
      status: TenantEmailRecipientStatus.FAILED,
      tenantName: "Zara",
    });
    const skipped = createRecipient({
      id: "skipped",
      status: TenantEmailRecipientStatus.SKIPPED,
      tenantName: "Anna",
    });
    const sentA = createRecipient({
      id: "sent-a",
      status: TenantEmailRecipientStatus.SENT,
      tenantName: "Mia",
    });
    const sentB = createRecipient({
      id: "sent-b",
      status: TenantEmailRecipientStatus.SENT,
      tenantName: "Leo",
    });

    const sorted = [sentB, failed, sentA, skipped].sort(compareTenantEmailCampaignRecipients);

    expect(sorted.map((recipient) => recipient.id)).toEqual([
      "failed",
      "skipped",
      "sent-b",
      "sent-a",
    ]);
  });
});
