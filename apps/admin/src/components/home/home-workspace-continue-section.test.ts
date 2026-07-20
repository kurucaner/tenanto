import { describe, expect, test } from "bun:test";

import {
  buildPropertyResumePath,
  resolveRecentPropertyTabLabel,
} from "@/components/home/home-workspace-continue-section";
import type { IRecentProperty } from "@/lib/recent-properties-storage";

const propertyId = "property-1";

function makeRecent(overrides: Partial<IRecentProperty> = {}): IRecentProperty {
  return {
    address: "123 Main St",
    id: propertyId,
    name: "Oak Street",
    visitedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildPropertyResumePath", () => {
  test("returns overview path when lastPath is absent", () => {
    expect(buildPropertyResumePath(propertyId)).toBe("/properties/property-1");
  });

  test("returns tab path when lastPath is present", () => {
    expect(buildPropertyResumePath(propertyId, "/leases")).toBe("/properties/property-1/leases");
  });
});

describe("resolveRecentPropertyTabLabel", () => {
  test("returns Overview for empty lastPath", () => {
    expect(resolveRecentPropertyTabLabel(makeRecent({ lastPath: "" }))).toBe("Overview");
  });

  test("returns Leases for lease tab suffix", () => {
    expect(resolveRecentPropertyTabLabel(makeRecent({ lastPath: "/leases" }))).toBe("Leases");
  });

  test("returns Leases for nested lease detail suffix", () => {
    expect(resolveRecentPropertyTabLabel(makeRecent({ lastPath: "/leases/lease-456" }))).toBe(
      "Leases"
    );
  });
});
