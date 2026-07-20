import { describe, expect, test } from "bun:test";

import {
  derivePropertyPermissionsFromListItem,
  type IPropertyPermissions,
} from "@/hooks/use-property-permissions";
import {
  getHomePropertyLauncherShortcutPaths,
  getVisiblePropertyLauncherDestinations,
} from "@/lib/property-launcher-destinations";
import type { IProperty } from "@/packages/shared";
import { PropertyRole, UserType } from "@/packages/shared";

const propertyId = "property-1";
const creatorId = "creator-1";
const ownerId = "owner-1";
const managerId = "manager-1";
const accountantId = "accountant-1";
const adminId = "admin-1";

function makeListProperty(overrides: Partial<IProperty> = {}): IProperty {
  return {
    address: "123 Main St",
    callerRole: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: creatorId,
    favoritedAt: null,
    id: propertyId,
    isFavorite: false,
    legalName: null,
    memberCount: 1,
    name: "Test Property",
    phoneNumber: null,
    unitCount: 0,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeUser(id: string, userType: UserType) {
  return {
    appleId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    email: `${id}@example.com`,
    googleId: null,
    id,
    name: id,
    onboardingCompletedAt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    userType,
  };
}

function homePaths(permissions: IPropertyPermissions): string[] {
  return getVisiblePropertyLauncherDestinations(permissions)
    .filter((destination) => destination.showOnHome)
    .map((destination) => destination.path);
}

function palettePaths(permissions: IPropertyPermissions): string[] {
  return getVisiblePropertyLauncherDestinations(permissions)
    .filter((destination) => destination.showInCommandPalette)
    .map((destination) => destination.path);
}

describe("getVisiblePropertyLauncherDestinations", () => {
  test("owner sees operational shortcuts on Home and full palette", () => {
    const permissions = derivePropertyPermissionsFromListItem(
      makeListProperty({ callerRole: PropertyRole.OWNER }),
      makeUser(ownerId, UserType.USER)
    );

    expect(homePaths(permissions)).toEqual(["units", "leases", "income", "expenses"]);
    expect(palettePaths(permissions)).toEqual([
      "",
      "units",
      "leases",
      "income",
      "expenses",
      "exports",
      "communications",
      "reports",
      "settings",
    ]);
  });

  test("manager sees operational Home shortcuts without communications in palette", () => {
    const permissions = derivePropertyPermissionsFromListItem(
      makeListProperty({ callerRole: PropertyRole.MANAGER }),
      makeUser(managerId, UserType.USER)
    );

    expect(homePaths(permissions)).toEqual(["units", "leases", "income", "expenses"]);
    expect(palettePaths(permissions)).not.toContain("communications");
    expect(palettePaths(permissions)).toEqual([
      "",
      "units",
      "leases",
      "income",
      "expenses",
      "exports",
      "reports",
      "settings",
    ]);
  });

  test("accountant sees read-only Home shortcuts without communications", () => {
    const permissions = derivePropertyPermissionsFromListItem(
      makeListProperty({ callerRole: PropertyRole.ACCOUNTANT }),
      makeUser(accountantId, UserType.USER)
    );

    expect(homePaths(permissions)).toEqual(["units", "leases", "income", "expenses"]);
    expect(palettePaths(permissions)).not.toContain("communications");
  });

  test("platform admin sees full palette including communications", () => {
    const permissions = derivePropertyPermissionsFromListItem(
      makeListProperty(),
      makeUser(adminId, UserType.ADMIN)
    );

    expect(palettePaths(permissions)).toContain("communications");
    expect(homePaths(permissions)).toEqual(["units", "leases", "income", "expenses"]);
  });

  test("communications hidden when caller lacks tenant notification permission", () => {
    const permissions = derivePropertyPermissionsFromListItem(
      makeListProperty({ callerRole: PropertyRole.MANAGER }),
      makeUser(managerId, UserType.USER)
    );

    const destinations = getVisiblePropertyLauncherDestinations(permissions);
    expect(destinations.some((destination) => destination.path === "communications")).toBe(false);
  });
});

describe("getHomePropertyLauncherShortcutPaths", () => {
  test("owner gets operational shortcuts with correct tab routes", () => {
    const permissions = derivePropertyPermissionsFromListItem(
      makeListProperty({ callerRole: PropertyRole.OWNER }),
      makeUser(ownerId, UserType.USER)
    );

    expect(getHomePropertyLauncherShortcutPaths(propertyId, permissions)).toEqual([
      { label: "Units", path: "/properties/property-1/units" },
      { label: "Leases", path: "/properties/property-1/leases" },
      { label: "Income", path: "/properties/property-1/income" },
      { label: "Expenses", path: "/properties/property-1/expenses" },
    ]);
  });

  test("manager omits communications shortcuts", () => {
    const permissions = derivePropertyPermissionsFromListItem(
      makeListProperty({ callerRole: PropertyRole.MANAGER }),
      makeUser(managerId, UserType.USER)
    );

    const shortcuts = getHomePropertyLauncherShortcutPaths(propertyId, permissions);
    expect(shortcuts.some((shortcut) => shortcut.label === "Communications")).toBe(false);
    expect(shortcuts).toHaveLength(4);
  });
});
