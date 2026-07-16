import { describe, expect, test } from "bun:test";

import { computeTenantBalanceFromRentSchedule } from "./tenant-rent-balance-from-schedule";

describe("computeTenantBalanceFromRentSchedule", () => {
  test("sums remaining cents for due months from schedule paidRent rollup", () => {
    const balance = computeTenantBalanceFromRentSchedule(
      [
        { expectedRent: 1500, month: "2026-01", paidRent: 0 },
        { expectedRent: 1500, month: "2026-02", paidRent: 500 },
      ],
      "2026-02"
    );

    expect(balance.amountDueCents).toBe(2500_00);
    expect(balance.periodMonths).toEqual(["2026-01", "2026-02"]);
    expect(balance.periods[1]).toMatchObject({
      month: "2026-02",
      paidCents: 500_00,
      remainingCents: 1000_00,
    });
  });

  test("returns zero due when schedule months are fully paid", () => {
    const balance = computeTenantBalanceFromRentSchedule(
      [{ expectedRent: 1500, month: "2026-01", paidRent: 1500 }],
      "2026-01"
    );

    expect(balance.amountDueCents).toBe(0);
    expect(balance.periodMonths).toEqual([]);
  });

  test("excludes upcoming months beyond asOfMonth", () => {
    const balance = computeTenantBalanceFromRentSchedule(
      [
        { expectedRent: 1500, month: "2026-01", paidRent: 500 },
        { expectedRent: 1500, month: "2026-03", paidRent: 0 },
      ],
      "2026-01"
    );

    expect(balance.amountDueCents).toBe(1000_00);
    expect(balance.periodMonths).toEqual(["2026-01"]);
  });

  test("reflects partial Stripe allocation already included in paidRent", () => {
    const balance = computeTenantBalanceFromRentSchedule(
      [{ expectedRent: 1500, month: "2026-01", paidRent: 500 }],
      "2026-01"
    );

    expect(balance.amountDueCents).toBe(1000_00);
    expect(balance.periods[0]).toMatchObject({
      expectedCents: 1500_00,
      paidCents: 500_00,
      remainingCents: 1000_00,
    });
  });
});
