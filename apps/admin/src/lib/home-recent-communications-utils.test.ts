import { describe, expect, test } from "bun:test";

import {
  buildHomeCommunicationsCampaignHref,
  buildHomeRecentCommunicationRowLabel,
  hasHomeRecentCommunicationsSendAccess,
  isHomeRecentTenantEmailCampaignInProgress,
} from "@/lib/home-recent-communications-utils";
import { PropertyRole, TenantEmailCampaignStatus, UserType } from "@/packages/shared";

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

describe("hasHomeRecentCommunicationsSendAccess", () => {
  test("returns true for platform admins even with an empty workspace list", () => {
    expect(
      hasHomeRecentCommunicationsSendAccess([], {
        appleId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        email: "admin@example.com",
        googleId: null,
        id: "admin-1",
        name: "Admin",
        onboardingCompletedAt: null,
        updatedAt: "2026-01-01T00:00:00.000Z",
        userType: UserType.ADMIN,
      })
    ).toBe(true);
  });

  test("returns true when any workspace property grants send access", () => {
    expect(
      hasHomeRecentCommunicationsSendAccess(
        [
          {
            address: "123 Main St",
            callerRole: PropertyRole.MANAGER,
            createdAt: "2026-01-01T00:00:00.000Z",
            createdBy: "creator-1",
            favoritedAt: null,
            id: "property-1",
            isFavorite: false,
            legalName: null,
            memberCount: 1,
            name: "Managed Property",
            phoneNumber: null,
            unitCount: 1,
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
          {
            address: "456 Oak Ave",
            callerRole: PropertyRole.OWNER,
            createdAt: "2026-01-01T00:00:00.000Z",
            createdBy: "creator-2",
            favoritedAt: null,
            id: "property-2",
            isFavorite: false,
            legalName: null,
            memberCount: 1,
            name: "Owned Property",
            phoneNumber: null,
            unitCount: 1,
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        {
          appleId: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          email: "owner@example.com",
          googleId: null,
          id: "owner-1",
          name: "Owner",
          onboardingCompletedAt: null,
          updatedAt: "2026-01-01T00:00:00.000Z",
          userType: UserType.USER,
        }
      )
    ).toBe(true);
  });

  test("returns false for manager or accountant-only workspace lists", () => {
    const user = {
      appleId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      email: "manager@example.com",
      googleId: null,
      id: "manager-1",
      name: "Manager",
      onboardingCompletedAt: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
      userType: UserType.USER,
    };

    expect(
      hasHomeRecentCommunicationsSendAccess(
        [
          {
            address: "123 Main St",
            callerRole: PropertyRole.MANAGER,
            createdAt: "2026-01-01T00:00:00.000Z",
            createdBy: "creator-1",
            favoritedAt: null,
            id: "property-1",
            isFavorite: false,
            legalName: null,
            memberCount: 1,
            name: "Managed Property",
            phoneNumber: null,
            unitCount: 1,
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        user
      )
    ).toBe(false);

    expect(
      hasHomeRecentCommunicationsSendAccess(
        [
          {
            address: "789 Pine Rd",
            callerRole: PropertyRole.ACCOUNTANT,
            createdAt: "2026-01-01T00:00:00.000Z",
            createdBy: "creator-1",
            favoritedAt: null,
            id: "property-2",
            isFavorite: false,
            legalName: null,
            memberCount: 1,
            name: "Accounted Property",
            phoneNumber: null,
            unitCount: 1,
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        user
      )
    ).toBe(false);
  });
});
