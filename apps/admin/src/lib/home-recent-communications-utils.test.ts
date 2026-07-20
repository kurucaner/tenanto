import { describe, expect, test } from "bun:test";

import {
  buildHomeCommunicationsCampaignHref,
  buildHomeRecentCommunicationRowLabel,
  isHomeRecentTenantEmailCampaignInProgress,
} from "@/lib/home-recent-communications-utils";
import { TenantEmailCampaignStatus } from "@/packages/shared";

describe("buildHomeCommunicationsCampaignHref", () => {
  test("builds property communications deep link with encoded ids", () => {
    expect(buildHomeCommunicationsCampaignHref("property 1", "campaign/2")).toBe(
      "/properties/property%201/communications?campaignId=campaign%2F2"
    );
  });
});

describe("buildHomeRecentCommunicationRowLabel", () => {
  test("prefixes property name before subject", () => {
    expect(
      buildHomeRecentCommunicationRowLabel({
        propertyName: "Alpha Property",
        subject: "Rent reminder July",
      })
    ).toBe("Alpha Property / Rent reminder July");
  });
});

describe("isHomeRecentTenantEmailCampaignInProgress", () => {
  test("returns true for queued and sending statuses", () => {
    expect(isHomeRecentTenantEmailCampaignInProgress(TenantEmailCampaignStatus.QUEUED)).toBe(true);
    expect(isHomeRecentTenantEmailCampaignInProgress(TenantEmailCampaignStatus.SENDING)).toBe(true);
  });

  test("returns false for terminal statuses", () => {
    expect(isHomeRecentTenantEmailCampaignInProgress(TenantEmailCampaignStatus.COMPLETED)).toBe(
      false
    );
    expect(
      isHomeRecentTenantEmailCampaignInProgress(TenantEmailCampaignStatus.COMPLETED_WITH_ERRORS)
    ).toBe(false);
    expect(isHomeRecentTenantEmailCampaignInProgress(TenantEmailCampaignStatus.FAILED)).toBe(false);
  });
});
