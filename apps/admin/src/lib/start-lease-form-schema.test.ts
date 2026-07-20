import { describe, expect, test } from "bun:test";

import {
  DEFAULT_START_LEASE_TERM_MONTHS,
  getStartLeaseDefaultValues,
  validateStartLeaseStep,
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

describe("validateStartLeaseStep", () => {
  test("term step passes without monthly rent", () => {
    const values = getStartLeaseDefaultValues("unit-42");
    values.guestName = "Caner";

    expect(validateStartLeaseStep("term", values).success).toBe(true);
  });

  test("rent step fails without monthly rent", () => {
    const values = getStartLeaseDefaultValues("unit-42");
    values.guestName = "Caner";

    expect(validateStartLeaseStep("rent", values).success).toBe(false);
  });
});
