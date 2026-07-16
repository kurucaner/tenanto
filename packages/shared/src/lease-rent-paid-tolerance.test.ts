import { describe, expect, test } from "bun:test";

import {
  isLeaseRentMonthFullyPaid,
  isLeaseRentPeriodFullyPaidCents,
  LEASE_RENT_PAID_TOLERANCE_CENTS,
  LEASE_RENT_PAID_TOLERANCE_DOLLARS,
} from "./lease-rent-paid-tolerance";

describe("lease rent paid tolerance", () => {
  test("exports matching dollar and cent tolerances", () => {
    expect(LEASE_RENT_PAID_TOLERANCE_DOLLARS).toBe(0.01);
    expect(LEASE_RENT_PAID_TOLERANCE_CENTS).toBe(1);
  });

  test("treats schedule dollars within tolerance as fully paid", () => {
    expect(isLeaseRentMonthFullyPaid(1500, 1499.99)).toBe(true);
    expect(isLeaseRentMonthFullyPaid(1500, 1499.98)).toBe(false);
  });

  test("treats tenant cents within tolerance as fully paid", () => {
    expect(isLeaseRentPeriodFullyPaidCents(150_000, 149_999)).toBe(true);
    expect(isLeaseRentPeriodFullyPaidCents(150_000, 149_998)).toBe(false);
  });
});
