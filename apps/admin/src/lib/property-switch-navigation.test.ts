import { describe, expect, test } from "bun:test";

import {
  buildPropertyResumePath,
  buildPropertySwitchPath,
  getPropertyTabSuffix,
  sanitizePropertySwitchSearchParams,
} from "./property-switch-navigation";

describe("getPropertyTabSuffix", () => {
  const propertyId = "abc-123";

  test("returns empty string for overview", () => {
    expect(getPropertyTabSuffix(`/properties/${propertyId}`, propertyId)).toBe("");
    expect(getPropertyTabSuffix(`/properties/${propertyId}/`, propertyId)).toBe("");
  });

  test("returns tab segment for nested routes", () => {
    expect(getPropertyTabSuffix(`/properties/${propertyId}/income`, propertyId)).toBe("/income");
    expect(getPropertyTabSuffix(`/properties/${propertyId}/reports`, propertyId)).toBe("/reports");
  });

  test("returns empty string for unrelated paths", () => {
    expect(getPropertyTabSuffix("/properties/other-id/income", propertyId)).toBe("");
  });
});

describe("sanitizePropertySwitchSearchParams", () => {
  test("keeps cross-property-safe params", () => {
    expect(
      sanitizePropertySwitchSearchParams(
        "?from=2026-01-01&to=2026-01-31&channelCommissionId=channel-airbnb&rentalType=short_term"
      )
    ).toBe(
      "?channelCommissionId=channel-airbnb&from=2026-01-01&rentalType=short_term&to=2026-01-31"
    );
  });

  test("strips property-scoped params", () => {
    expect(
      sanitizePropertySwitchSearchParams(
        "?from=2026-01-01&unitId=unit-1&sort=date&dir=desc&salesSort=name&channelSort=amount"
      )
    ).toBe("?from=2026-01-01");
  });

  test("returns empty string when nothing is preserved", () => {
    expect(sanitizePropertySwitchSearchParams("?unitId=unit-1&status=confirmed")).toBe("");
  });
});

describe("buildPropertySwitchPath", () => {
  test("preserves tab and sanitized search params", () => {
    expect(
      buildPropertySwitchPath({
        nextPropertyId: "next-id",
        pathname: "/properties/current-id/income",
        propertyId: "current-id",
        search: "?from=2026-01-01&unitId=unit-1",
      })
    ).toBe("/properties/next-id/income?from=2026-01-01");
  });
});

describe("buildPropertyResumePath", () => {
  const propertyId = "abc-123";

  test("returns overview path when lastPath is absent or empty", () => {
    expect(buildPropertyResumePath(propertyId)).toBe(`/properties/${propertyId}`);
    expect(buildPropertyResumePath(propertyId, "")).toBe(`/properties/${propertyId}`);
  });

  test("returns tab path for top-level shell tabs", () => {
    expect(buildPropertyResumePath(propertyId, "/income")).toBe(`/properties/${propertyId}/income`);
    expect(buildPropertyResumePath(propertyId, "/leases")).toBe(`/properties/${propertyId}/leases`);
  });

  test("falls back to list tab for nested routes in v1", () => {
    expect(buildPropertyResumePath(propertyId, "/leases/lease-456")).toBe(
      `/properties/${propertyId}/leases`
    );
  });
});
