import { describe, expect, test } from "bun:test";

import {
  DEFAULT_START_LEASE_TERM_MONTHS,
  getStartLeaseDefaultValues,
} from "./start-lease-form-schema";

describe("getStartLeaseDefaultValues", () => {
  test("prefills unitId when provided", () => {
    expect(getStartLeaseDefaultValues("unit-42").unitId).toBe("unit-42");
  });

  test("uses default term months and empty tenant fields", () => {
    const values = getStartLeaseDefaultValues();
    expect(values.termMonths).toBe(DEFAULT_START_LEASE_TERM_MONTHS);
    expect(values.guestName).toBe("");
    expect(values.monthlyRent).toBe("");
    expect(values.unitId).toBe("");
  });
});
