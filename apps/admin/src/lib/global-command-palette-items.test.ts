import { describe, expect, test } from "bun:test";

import {
  buildPropertyPaletteCommandItems,
  buildPropertyTabPaletteCommandItems,
  buildRecentPaletteCommandItems,
} from "@/lib/global-command-palette-items";
import type { IProperty } from "@/packages/shared";
import { PropertyRole, UserType } from "@/packages/shared";

const propertyId = "property-1";
const ownerId = "owner-1";

function makeListProperty(overrides: Partial<IProperty> = {}): IProperty {
  return {
    address: "123 Main St",
    callerRole: PropertyRole.OWNER,
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: ownerId,
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

describe("buildPropertyPaletteCommandItems", () => {
  test("owner gets property-scoped destinations including Expenses", () => {
    const property = makeListProperty();
    const currentUser = makeUser(ownerId, UserType.USER);

    const items = buildPropertyPaletteCommandItems(property, currentUser);
    const expensesItem = items.find((item) => item.label.includes("Expenses"));

    expect(expensesItem).toEqual({
      id: "property-1-Expenses",
      label: "Test Property → Expenses",
      path: "/properties/property-1/expenses",
      value: "Test Property 123 Main St Expenses",
    });
  });
});

describe("buildPropertyTabPaletteCommandItems", () => {
  test("returns only the requested tab destination when visible", () => {
    const property = makeListProperty();
    const currentUser = makeUser(ownerId, UserType.USER);

    const items = buildPropertyTabPaletteCommandItems(
      property,
      { label: "Exports", path: "exports" },
      currentUser
    );

    expect(items).toEqual([
      {
        id: "property-1-Exports",
        label: "Test Property → Exports",
        path: "/properties/property-1/exports",
        value: "Test Property 123 Main St Exports",
      },
    ]);
  });
});

describe("buildRecentPaletteCommandItems", () => {
  test("uses destination actions when property is in list cache", () => {
    const property = makeListProperty();
    const currentUser = makeUser(ownerId, UserType.USER);
    const recentEntry = {
      address: property.address,
      id: property.id,
      lastPath: "/income",
      name: property.name,
      visitedAt: "2026-01-02T00:00:00.000Z",
    };

    const items = buildRecentPaletteCommandItems(recentEntry, property, currentUser);

    expect(items.some((item) => item.path === "/properties/property-1/expenses")).toBe(true);
  });

  test("falls back to resume path when property is missing from list cache", () => {
    const recentEntry = {
      address: "123 Main St",
      id: propertyId,
      lastPath: "/income",
      name: "Test Property",
      visitedAt: "2026-01-02T00:00:00.000Z",
    };

    const items = buildRecentPaletteCommandItems(recentEntry, undefined, null);

    expect(items).toEqual([
      {
        id: "recent-resume-property-1",
        label: "Test Property → Resume",
        path: "/properties/property-1/income",
        value: "Test Property 123 Main St resume",
      },
    ]);
  });
});
