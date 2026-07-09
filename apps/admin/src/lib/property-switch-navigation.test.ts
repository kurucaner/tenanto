import { describe, expect, test } from "bun:test";

import {
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
        "?from=2026-01-01&to=2026-01-31&channel=airbnb&rentalType=short_term"
      )
    ).toBe("?channel=airbnb&from=2026-01-01&rentalType=short_term&to=2026-01-31");
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
