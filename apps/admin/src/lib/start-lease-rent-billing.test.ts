import { describe, expect, test } from "bun:test";

import {
  getStartLeaseFirstPeriodRentPreview,
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

describe("getStartLeaseFirstPeriodRentPreview", () => {
  test("routes to weekly preview for weekly cadence", () => {
    expect(
      getStartLeaseFirstPeriodRentPreview({
        leaseEndDate: "2026-01-20",
        leaseStartDate: "2026-01-15",
        rentAmount: 700,
        rentBillingCadence: "weekly",
      })
    ).toBe("First week rent: $600 (6/7 days)");
  });

  test("routes to monthly preview for monthly cadence", () => {
    expect(
      getStartLeaseFirstPeriodRentPreview({
        leaseEndDate: "2025-06-15",
        leaseStartDate: "2024-06-16",
        rentAmount: 1000,
        rentBillingCadence: "monthly",
      })
    ).toBe("First month rent: $500 (15/30 days)");
  });

  test("returns null when the first month is not prorated", () => {
    expect(
      getStartLeaseFirstPeriodRentPreview({
        leaseEndDate: "2025-06-01",
        leaseStartDate: "2024-06-01",
        rentAmount: 1000,
        rentBillingCadence: "monthly",
      })
    ).toBeNull();
  });

  test("returns null when the first week is not prorated", () => {
    expect(
      getStartLeaseFirstPeriodRentPreview({
        leaseEndDate: "2026-03-31",
        leaseStartDate: "2026-01-15",
        rentAmount: 700,
        rentBillingCadence: "weekly",
      })
    ).toBeNull();
  });
});
