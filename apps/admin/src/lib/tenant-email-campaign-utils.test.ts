import { describe, expect, test } from "bun:test";

import { TenantEmailCampaignStatus } from "@/packages/shared";

import {
  getTenantEmailCampaignProcessedCount,
  isTenantEmailCampaignInProgress,
  isTenantEmailCampaignTerminal,
} from "./tenant-email-campaign-utils";

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
});
