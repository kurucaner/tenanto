import { describe, expect, test } from "bun:test";

import {
  allocateFifo,
  buildRentCheckoutIdempotencyKey,
  computePeriodRemainingCents,
  computeRemainingByMonth,
  dollarsToCents,
  isValidPeriodMonth,
  selectDuePeriodMonths,
  STRIPE_MIN_CHARGE_CENTS_USD,
  sumAmountDueCents,
  validateCreateRentCheckoutBody,
} from "./tenant-rent-payment-utils";

describe("dollarsToCents", () => {
  test("rounds to nearest cent", () => {
    expect(dollarsToCents(200)).toBe(200_00);
    expect(dollarsToCents(12.345)).toBe(1235);
  });
});

describe("buildRentCheckoutIdempotencyKey", () => {
  test("is stable for same inputs regardless of month order", () => {
    const a = buildRentCheckoutIdempotencyKey({
      amountCents: 100,
      leaseId: "lease-1",
      periodMonths: ["2026-02", "2026-01"],
      tenantUserId: "tenant-1",
    });
    const b = buildRentCheckoutIdempotencyKey({
      amountCents: 100,
      leaseId: "lease-1",
      periodMonths: ["2026-01", "2026-02"],
      tenantUserId: "tenant-1",
    });
    expect(a).toBe(b);
  });
});

describe("computePeriodRemainingCents", () => {
  test("subtracts paid from expected", () => {
    expect(computePeriodRemainingCents(100_00, 40_00)).toBe(60_00);
  });

  test("never goes negative", () => {
    expect(computePeriodRemainingCents(100_00, 150_00)).toBe(0);
  });
});

describe("computeRemainingByMonth", () => {
  test("maps periods with remaining", () => {
    expect(
      computeRemainingByMonth([
        { expectedCents: 200_00, month: "2026-01", paidCents: 50_00 },
        { expectedCents: 200_00, month: "2026-02", paidCents: 200_00 },
      ])
    ).toEqual([
      {
        expectedCents: 200_00,
        month: "2026-01",
        paidCents: 50_00,
        remainingCents: 150_00,
      },
      {
        expectedCents: 200_00,
        month: "2026-02",
        paidCents: 200_00,
        remainingCents: 0,
      },
    ]);
  });
});

describe("sumAmountDueCents", () => {
  const periods = computeRemainingByMonth([
    { expectedCents: 100_00, month: "2026-01", paidCents: 0 },
    { expectedCents: 100_00, month: "2026-02", paidCents: 0 },
    { expectedCents: 100_00, month: "2026-03", paidCents: 0 },
  ]);

  test("sums all remaining when asOfMonth omitted", () => {
    expect(sumAmountDueCents(periods)).toBe(300_00);
  });

  test("excludes months after asOfMonth", () => {
    expect(sumAmountDueCents(periods, "2026-02")).toBe(200_00);
  });
});

describe("selectDuePeriodMonths", () => {
  const periods = computeRemainingByMonth([
    { expectedCents: 100_00, month: "2026-01", paidCents: 0 },
    { expectedCents: 100_00, month: "2026-02", paidCents: 100_00 },
    { expectedCents: 100_00, month: "2026-03", paidCents: 0 },
  ]);

  test("returns unpaid months through asOfMonth, sorted", () => {
    expect(selectDuePeriodMonths(periods, "2026-03")).toEqual(["2026-01", "2026-03"]);
    expect(selectDuePeriodMonths(periods, "2026-02")).toEqual(["2026-01"]);
  });
});

describe("isValidPeriodMonth", () => {
  test("accepts YYYY-MM", () => {
    expect(isValidPeriodMonth("2026-07")).toBe(true);
    expect(isValidPeriodMonth("2026-13")).toBe(false);
    expect(isValidPeriodMonth("2026-7")).toBe(false);
  });
});

describe("allocateFifo", () => {
  test("fills earliest months first", () => {
    expect(
      allocateFifo(250_00, [
        { expectedCents: 200_00, month: "2026-03", remainingCents: 200_00 },
        { expectedCents: 200_00, month: "2026-01", remainingCents: 200_00 },
        { expectedCents: 200_00, month: "2026-02", remainingCents: 200_00 },
      ])
    ).toEqual([
      { allocatedCents: 200_00, expectedCentsSnapshot: 200_00, month: "2026-01" },
      { allocatedCents: 50_00, expectedCentsSnapshot: 200_00, month: "2026-02" },
    ]);
  });

  test("returns empty for non-positive amount", () => {
    expect(
      allocateFifo(0, [{ expectedCents: 100, month: "2026-01", remainingCents: 100 }])
    ).toEqual([]);
  });
});

describe("validateCreateRentCheckoutBody", () => {
  const periods = computeRemainingByMonth([
    { expectedCents: 200_00, month: "2026-01", paidCents: 0 },
    { expectedCents: 200_00, month: "2026-02", paidCents: 50_00 },
  ]);

  test("accepts full pay of selected months with FIFO allocations", () => {
    const result = validateCreateRentCheckoutBody({
      amountCents: 350_00,
      leaseId: "lease-1",
      periodMonths: ["2026-02", "2026-01"],
      periods,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.allocations).toEqual([
      { allocatedCents: 200_00, expectedCentsSnapshot: 200_00, month: "2026-01" },
      { allocatedCents: 150_00, expectedCentsSnapshot: 200_00, month: "2026-02" },
    ]);
  });

  test("accepts partial pay within selected remaining", () => {
    const result = validateCreateRentCheckoutBody({
      amountCents: 75_00,
      leaseId: "lease-1",
      periodMonths: ["2026-01"],
      periods,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.allocations).toEqual([
      { allocatedCents: 75_00, expectedCentsSnapshot: 200_00, month: "2026-01" },
    ]);
  });

  test("rejects amount below Stripe minimum", () => {
    const result = validateCreateRentCheckoutBody({
      amountCents: STRIPE_MIN_CHARGE_CENTS_USD - 1,
      leaseId: "lease-1",
      periodMonths: ["2026-01"],
      periods,
    });
    expect(result.ok).toBe(false);
  });

  test("rejects amount over selected remaining", () => {
    const result = validateCreateRentCheckoutBody({
      amountCents: 151_00,
      leaseId: "lease-1",
      periodMonths: ["2026-02"],
      periods,
    });
    expect(result.ok).toBe(false);
  });

  test("rejects duplicate months", () => {
    const result = validateCreateRentCheckoutBody({
      amountCents: 50_00,
      leaseId: "lease-1",
      periodMonths: ["2026-01", "2026-01"],
      periods,
    });
    expect(result.ok).toBe(false);
  });

  test("rejects fully paid month", () => {
    const paid = computeRemainingByMonth([
      { expectedCents: 100_00, month: "2026-01", paidCents: 100_00 },
    ]);
    const result = validateCreateRentCheckoutBody({
      amountCents: 50_00,
      leaseId: "lease-1",
      periodMonths: ["2026-01"],
      periods: paid,
    });
    expect(result.ok).toBe(false);
  });
});
