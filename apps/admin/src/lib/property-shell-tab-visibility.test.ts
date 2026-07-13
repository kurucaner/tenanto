import { describe, expect, test } from "bun:test";

import { derivePropertyPermissions } from "@/hooks/use-property-permissions";
import { getVisiblePropertyShellTabs } from "@/lib/property-shell-tab-visibility";
import { PropertyRole, UserType } from "@/packages/shared";

describe("getVisiblePropertyShellTabs", () => {
  test("hides communications tab without permission or feature flag", () => {
    const tabs = getVisiblePropertyShellTabs({
      callerMembership: undefined,
      canManageLedger: true,
      canManageMembers: false,
      canManageStructure: false,
      canManageUnits: true,
      canSendTenantNotifications: false,
      canView: true,
      isAdmin: false,
      isCreator: false,
    });

    expect(tabs.some((tab) => tab.path === "communications")).toBe(false);
  });

  test("shows communications tab for owners when feature flag enabled", () => {
    const previous = import.meta.env.VITE_TENANT_EMAIL_CAMPAIGNS_ENABLED;
    import.meta.env.VITE_TENANT_EMAIL_CAMPAIGNS_ENABLED = "true";

    const permissions = derivePropertyPermissions(undefined, {
      appleId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      email: "owner@example.com",
      googleId: null,
      id: "owner-1",
      name: "Owner",
      onboardingCompletedAt: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
      userType: UserType.USER,
    });

    const tabs = getVisiblePropertyShellTabs({
      ...permissions,
      callerMembership: {
        addedBy: "creator-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        id: "membership-1",
        propertyId: "property-1",
        role: PropertyRole.OWNER,
        updatedAt: "2026-01-01T00:00:00.000Z",
        user: { email: "owner@example.com", id: "owner-1", name: "Owner" },
        userId: "owner-1",
      },
      canSendTenantNotifications: true,
    });

    import.meta.env.VITE_TENANT_EMAIL_CAMPAIGNS_ENABLED = previous;
    expect(tabs.some((tab) => tab.path === "communications")).toBe(true);
  });
});
