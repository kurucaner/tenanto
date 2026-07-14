import { afterEach, describe, expect, mock, test } from "bun:test";

import { TenantEmailCampaignStatus } from "@/packages/shared";

const notifyUserMock = mock(() => Promise.resolve());

mock.module("@/services/user-notifications", () => ({
  notifyUser: notifyUserMock,
}));

const { notifyTenantEmailCampaignCompleted } = await import("./tenant-email-campaign-notifications");

const completedCampaign = {
  completedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  createdBy: "user-1",
  failedCount: 0,
  htmlBody: "<p>Hi</p>",
  id: "campaign-1",
  idempotencyKey: "key-1",
  propertyId: "property-1",
  recipientCount: 3,
  sentCount: 3,
  skippedCount: 0,
  status: TenantEmailCampaignStatus.COMPLETED,
  subject: "Hello",
  textBody: "Hi",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

afterEach(() => {
  notifyUserMock.mockClear();
});

describe("notifyTenantEmailCampaignCompleted", () => {
  test("creates a persisted campaign completion notification", async () => {
    await notifyTenantEmailCampaignCompleted(completedCampaign);

    expect(notifyUserMock).toHaveBeenCalledWith({
      body: "3 sent",
      contextResourceId: "campaign-1",
      resourceId: "property-1",
      resourceType: "property",
      title: "Notification delivered",
      type: "tenant_email_campaign_completed",
      userId: "user-1",
    });
  });

  test("uses exception copy when failures occurred", async () => {
    await notifyTenantEmailCampaignCompleted({
      ...completedCampaign,
      failedCount: 2,
      sentCount: 1,
      status: TenantEmailCampaignStatus.COMPLETED_WITH_ERRORS,
    });

    expect(notifyUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "1 sent · 2 failed",
        title: "Delivered with exceptions",
      })
    );
  });

  test("ignores duplicate notification inserts", async () => {
    notifyUserMock.mockImplementationOnce(() =>
      Promise.reject({ code: "23505", constraint: "user_notifications_campaign_completion_dedup" })
    );

    await expect(notifyTenantEmailCampaignCompleted(completedCampaign)).resolves.toBeUndefined();
  });
});
