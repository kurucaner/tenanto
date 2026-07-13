import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "bun:test";

import { queryKeys } from "@/lib/query-keys";
import {
  type ITenantEmailCampaignDetailResponse,
  TenantEmailCampaignStatus,
} from "@/packages/shared";

import {
  handleTenantEmailCampaignUpdated,
  parseTenantEmailCampaignUpdatedData,
} from "./notification-stream-handlers";

describe("parseTenantEmailCampaignUpdatedData", () => {
  test("parses valid campaign update payloads", () => {
    expect(
      parseTenantEmailCampaignUpdatedData({
        campaignId: "campaign-1",
        failedCount: 0,
        propertyId: "property-1",
        sentCount: 2,
        skippedCount: 1,
        status: TenantEmailCampaignStatus.SENDING,
        totalCount: 3,
      })
    ).toEqual({
      campaignId: "campaign-1",
      failedCount: 0,
      propertyId: "property-1",
      sentCount: 2,
      skippedCount: 1,
      status: TenantEmailCampaignStatus.SENDING,
      totalCount: 3,
    });
  });

  test("rejects malformed payloads", () => {
    expect(parseTenantEmailCampaignUpdatedData({ campaignId: "campaign-1" })).toBeNull();
  });
});

describe("handleTenantEmailCampaignUpdated", () => {
  test("patches cached campaign detail counts", () => {
    const queryClient = new QueryClient();
    const detail: ITenantEmailCampaignDetailResponse = {
      campaign: {
        completedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        createdBy: "user-1",
        failedCount: 0,
        htmlBody: "<p>Hi</p>",
        id: "campaign-1",
        idempotencyKey: "key-1",
        propertyId: "property-1",
        recipientCount: 3,
        sentCount: 0,
        skippedCount: 1,
        status: TenantEmailCampaignStatus.QUEUED,
        subject: "Hello",
        textBody: "Hi",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      recipients: [],
    };

    queryClient.setQueryData(
      queryKeys.propertyTenantEmailCampaign("property-1", "campaign-1"),
      detail
    );

    handleTenantEmailCampaignUpdated(
      queryClient,
      {
        campaignId: "campaign-1",
        failedCount: 0,
        propertyId: "property-1",
        sentCount: 2,
        skippedCount: 1,
        status: TenantEmailCampaignStatus.SENDING,
        totalCount: 3,
      },
      "/properties/property-1/income"
    );

    expect(
      queryClient.getQueryData<ITenantEmailCampaignDetailResponse>(
        queryKeys.propertyTenantEmailCampaign("property-1", "campaign-1")
      )?.campaign.sentCount
    ).toBe(2);
    expect(
      queryClient.getQueryData<ITenantEmailCampaignDetailResponse>(
        queryKeys.propertyTenantEmailCampaign("property-1", "campaign-1")
      )?.campaign.status
    ).toBe(TenantEmailCampaignStatus.SENDING);
  });
});
