import { describe, expect, test } from "bun:test";

import { TenantEmailCampaignStatus } from "@/packages/shared";

import {
  resetTenantEmailCampaignStreamThrottle,
  shouldEmitTenantEmailCampaignUpdate,
} from "./tenant-email-campaign-stream";

describe("shouldEmitTenantEmailCampaignUpdate", () => {
  test("always emits terminal statuses", () => {
    expect(
      shouldEmitTenantEmailCampaignUpdate(
        "campaign-1",
        3,
        TenantEmailCampaignStatus.COMPLETED,
        1_000
      )
    ).toBe(true);
    expect(
      shouldEmitTenantEmailCampaignUpdate(
        "campaign-1",
        3,
        TenantEmailCampaignStatus.COMPLETED,
        1_001
      )
    ).toBe(true);
  });

  test("throttles in-progress updates by sent delta and elapsed time", () => {
    resetTenantEmailCampaignStreamThrottle("campaign-2");

    expect(
      shouldEmitTenantEmailCampaignUpdate("campaign-2", 0, TenantEmailCampaignStatus.SENDING, 1_000)
    ).toBe(true);

    expect(
      shouldEmitTenantEmailCampaignUpdate("campaign-2", 5, TenantEmailCampaignStatus.SENDING, 1_500)
    ).toBe(false);

    expect(
      shouldEmitTenantEmailCampaignUpdate(
        "campaign-2",
        10,
        TenantEmailCampaignStatus.SENDING,
        1_600
      )
    ).toBe(true);

    expect(
      shouldEmitTenantEmailCampaignUpdate(
        "campaign-2",
        11,
        TenantEmailCampaignStatus.SENDING,
        3_700
      )
    ).toBe(true);
  });
});
