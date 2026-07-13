import { describe, expect, test } from "bun:test";

import { isPropertyLeaseDetailPath } from "./property-shell-routes";

describe("isPropertyLeaseDetailPath", () => {
  test("matches lease detail routes", () => {
    expect(isPropertyLeaseDetailPath("/properties/abc/leases/xyz")).toBe(true);
    expect(isPropertyLeaseDetailPath("/properties/prop-1/leases/lease-1")).toBe(true);
  });

  test("does not match leases list or other property routes", () => {
    expect(isPropertyLeaseDetailPath("/properties/abc/leases")).toBe(false);
    expect(isPropertyLeaseDetailPath("/properties/abc")).toBe(false);
    expect(isPropertyLeaseDetailPath("/properties/abc/income")).toBe(false);
    expect(isPropertyLeaseDetailPath("/properties")).toBe(false);
  });
});
