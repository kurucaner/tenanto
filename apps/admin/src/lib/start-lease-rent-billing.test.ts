import { describe, expect, test } from "bun:test";

import {
  getStartLeaseRentAmountLabel,
  normalizeStartLeaseRentBillingCadence,
} from "./start-lease-rent-billing";

describe("normalizeStartLeaseRentBillingCadence", () => {
  test("defaults unknown values to monthly", () => {
    expect(normalizeStartLeaseRentBillingCadence(undefined)).toBe("monthly");
    expect(normalizeStartLeaseRentBillingCadence("daily")).toBe("monthly");
  });

  test("keeps weekly when feature is enabled", () => {
    expect(normalizeStartLeaseRentBillingCadence("weekly")).toBe("weekly");
  });
});

describe("getStartLeaseRentAmountLabel", () => {
  test("uses cadence-specific amount labels", () => {
    expect(getStartLeaseRentAmountLabel("monthly")).toBe("Monthly rent");
    expect(getStartLeaseRentAmountLabel("weekly")).toBe("Weekly rent");
  });
});
