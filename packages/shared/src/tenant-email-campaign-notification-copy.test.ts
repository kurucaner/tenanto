import { describe, expect, test } from "bun:test";

import {
  buildTenantEmailCampaignCompletionBody,
  buildTenantEmailCampaignCompletionTitle,
  TenantEmailCampaignStatus,
} from "@/packages/shared";

describe("buildTenantEmailCampaignCompletionBody", () => {
  test("formats success and exception counts", () => {
    expect(buildTenantEmailCampaignCompletionBody(3, 0)).toBe("3 sent");
    expect(buildTenantEmailCampaignCompletionBody(3, 1)).toBe("3 sent · 1 failed");
  });
});

describe("buildTenantEmailCampaignCompletionTitle", () => {
  test("uses warning title when delivery had exceptions", () => {
    expect(
      buildTenantEmailCampaignCompletionTitle({
        failedCount: 1,
        status: TenantEmailCampaignStatus.COMPLETED_WITH_ERRORS,
      })
    ).toBe("Delivered with exceptions");
  });

  test("uses success title when delivery completed cleanly", () => {
    expect(
      buildTenantEmailCampaignCompletionTitle({
        failedCount: 0,
        status: TenantEmailCampaignStatus.COMPLETED,
      })
    ).toBe("Notification delivered");
  });
});
