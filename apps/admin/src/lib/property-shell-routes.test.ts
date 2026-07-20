import { describe, expect, test } from "bun:test";

import {
  isPropertyLeaseDetailPath,
  isPropertyLeaseFocusedPath,
} from "./property-shell-routes";

describe("isPropertyLeaseFocusedPath", () => {
  test("matches lease detail and start lease routes", () => {
    expect(isPropertyLeaseFocusedPath("/properties/abc/leases/xyz")).toBe(true);
    expect(isPropertyLeaseFocusedPath("/properties/prop-1/leases/lease-1")).toBe(true);
    expect(isPropertyLeaseFocusedPath("/properties/prop-1/leases/new")).toBe(true);
  });

  test("does not match leases list or other property routes", () => {
    expect(isPropertyLeaseFocusedPath("/properties/abc/leases")).toBe(false);
    expect(isPropertyLeaseFocusedPath("/properties/abc")).toBe(false);
    expect(isPropertyLeaseFocusedPath("/properties/abc/income")).toBe(false);
  });
});

describe("isPropertyLeaseDetailPath", () => {
  test("matches lease detail routes but not start lease", () => {
    expect(isPropertyLeaseDetailPath("/properties/abc/leases/xyz")).toBe(true);
    expect(isPropertyLeaseDetailPath("/properties/prop-1/leases/new")).toBe(false);
  });

  test("does not match leases list or other property routes", () => {
    expect(isPropertyLeaseDetailPath("/properties/abc/leases")).toBe(false);
    expect(isPropertyLeaseDetailPath("/properties/abc")).toBe(false);
  });
});
