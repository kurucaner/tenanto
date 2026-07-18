import { afterEach, describe, expect, mock, test } from "bun:test";

import { TenantEmailCampaignStatus, type ITenantEmailCampaign } from "@/packages/shared";
import { mockResolvedNull, mockResolvedVoid, mockSyncVoid } from "@/test-fixtures/mocks";

const findByIdMock = mockResolvedNull<ITenantEmailCampaign>();
const publishTenantEmailCampaignUpdatedMock = mockResolvedVoid();
const notifyUserMock = mockResolvedVoid();

mock.module("@/db/property-tenant-email-campaigns", () => ({
  propertyTenantEmailCampaignsDb: {
    findById: findByIdMock,
  },
}));

mock.module("@/services/notification-stream-hub", () => ({
  notificationStreamHub: {
    publishTenantEmailCampaignUpdated: publishTenantEmailCampaignUpdatedMock,
  },
}));

mock.module("@/services/user-notifications", () => ({
  notifyUser: notifyUserMock,
}));

mock.module("./tenant-email-campaign-observability", () => ({
  maybeLogTenantEmailCampaignCompletion: mockSyncVoid(),
}));

const { maybePublishTenantEmailCampaignUpdated } = await import("./tenant-email-campaign-stream");

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
  findByIdMock.mockClear();
  publishTenantEmailCampaignUpdatedMock.mockClear();
  notifyUserMock.mockClear();
});

describe("maybePublishTenantEmailCampaignUpdated notifications", () => {
  test("creates an inbox notification only on the first terminal transition", async () => {
    findByIdMock.mockResolvedValueOnce(completedCampaign);

    await maybePublishTenantEmailCampaignUpdated("campaign-1", { transitionedToTerminal: true });

    expect(publishTenantEmailCampaignUpdatedMock).toHaveBeenCalledTimes(1);
    expect(notifyUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        contextResourceId: "campaign-1",
        type: "tenant_email_campaign_completed",
        userId: "user-1",
      })
    );
  });

  test("skips inbox notification when the campaign was already terminal", async () => {
    findByIdMock.mockResolvedValueOnce(completedCampaign);

    await maybePublishTenantEmailCampaignUpdated("campaign-1", { transitionedToTerminal: false });

    expect(publishTenantEmailCampaignUpdatedMock).toHaveBeenCalledTimes(1);
    expect(notifyUserMock).not.toHaveBeenCalled();
  });
});
