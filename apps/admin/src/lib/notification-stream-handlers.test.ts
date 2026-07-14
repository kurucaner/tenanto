import { QueryClient } from "@tanstack/react-query";
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import { queryKeys } from "@/lib/query-keys";
import {
  type ITenantEmailCampaignDetailResponse,
  TenantEmailCampaignStatus,
} from "@/packages/shared";

mock.module("./show-property-export-queued-toast", () => ({
  showPropertyExportCompletedToast: mock(() => undefined),
  showPropertyExportQueuedToast: mock(() => undefined),
}));

const { handleTenantEmailCampaignUpdated, parseTenantEmailCampaignUpdatedData } =
  await import("./notification-stream-handlers");

const terminalUpdate = {
  campaignId: "campaign-1",
  failedCount: 0,
  propertyId: "property-1",
  sentCount: 3,
  skippedCount: 0,
  status: TenantEmailCampaignStatus.COMPLETED,
  totalCount: 3,
};

const inProgressUpdate = {
  campaignId: "campaign-1",
  failedCount: 0,
  propertyId: "property-1",
  sentCount: 1,
  skippedCount: 0,
  status: TenantEmailCampaignStatus.SENDING,
  totalCount: 3,
};

function trackInvalidateQueries(queryClient: QueryClient): unknown[][] {
  const invalidatedKeys: unknown[][] = [];
  const originalInvalidate = queryClient.invalidateQueries.bind(queryClient);
  queryClient.invalidateQueries = ((options) => {
    if (options?.queryKey != null) {
      invalidatedKeys.push(options.queryKey as unknown[]);
    }
    return originalInvalidate(options);
  }) as typeof queryClient.invalidateQueries;
  return invalidatedKeys;
}

const originalDocument = globalThis.document;

beforeAll(() => {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { visibilityState: "visible" },
    writable: true,
  });
});

afterAll(() => {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: originalDocument,
    writable: true,
  });
});

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

  test("invalidates campaign detail cache on terminal updates", () => {
    const queryClient = new QueryClient();
    const invalidatedKeys = trackInvalidateQueries(queryClient);

    handleTenantEmailCampaignUpdated(queryClient, terminalUpdate, "/properties/property-1/income");

    expect(invalidatedKeys).toContainEqual([
      ...queryKeys.propertyTenantEmailCampaign("property-1", "campaign-1"),
    ]);
    expect(invalidatedKeys).toContainEqual([
      ...queryKeys.propertyTenantEmailCampaigns("property-1"),
    ]);
  });

  test("does not invalidate campaign detail cache on in-progress updates", () => {
    const queryClient = new QueryClient();
    const invalidatedKeys = trackInvalidateQueries(queryClient);

    handleTenantEmailCampaignUpdated(
      queryClient,
      inProgressUpdate,
      "/properties/property-1/income"
    );

    expect(invalidatedKeys).toContainEqual([
      ...queryKeys.propertyTenantEmailCampaigns("property-1"),
    ]);
    expect(invalidatedKeys).not.toContainEqual([
      ...queryKeys.propertyTenantEmailCampaign("property-1", "campaign-1"),
    ]);
  });

  test("does not fetch detail on Communications tab when terminal update arrives", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    const fetchQueryMock = mock(async () => undefined);
    queryClient.fetchQuery = fetchQueryMock as typeof queryClient.fetchQuery;
    const invalidatedKeys = trackInvalidateQueries(queryClient);

    handleTenantEmailCampaignUpdated(
      queryClient,
      terminalUpdate,
      "/properties/property-1/communications"
    );

    expect(fetchQueryMock).not.toHaveBeenCalled();
    expect(invalidatedKeys).toContainEqual([
      ...queryKeys.propertyTenantEmailCampaign("property-1", "campaign-1"),
    ]);
  });
});
