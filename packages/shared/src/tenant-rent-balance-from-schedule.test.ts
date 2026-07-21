import { describe, expect, test } from "bun:test";

import { computeTenantBalanceFromRentSchedule } from "./tenant-rent-balance-from-schedule";

describe("computeTenantBalanceFromRentSchedule", () => {
  test("sums remaining cents for due months from schedule paidRent rollup", () => {
    const balance = computeTenantBalanceFromRentSchedule(
      [
        { expectedRent: 1500, paidRent: 0, periodKey: "2026-01" },
        { expectedRent: 1500, paidRent: 500, periodKey: "2026-02" },
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
      [{ expectedRent: 1500, paidRent: 1500, periodKey: "2026-01" }],
      "2026-01"
    );

    expect(balance.amountDueCents).toBe(0);
    expect(balance.periodMonths).toEqual([]);
  });

  test("excludes upcoming months beyond asOfMonth", () => {
    const balance = computeTenantBalanceFromRentSchedule(
      [
        { expectedRent: 1500, paidRent: 500, periodKey: "2026-01" },
        { expectedRent: 1500, paidRent: 0, periodKey: "2026-03" },
      ],
      "2026-01"
    );

    expect(balance.amountDueCents).toBe(1000_00);
    expect(balance.periodMonths).toEqual(["2026-01"]);
  });

  test("reflects partial refund already included in paidRent", () => {
    const balance = computeTenantBalanceFromRentSchedule(
      [{ expectedRent: 1500, paidRent: 1000, periodKey: "2026-01" }],
      "2026-01"
    );

    expect(balance.amountDueCents).toBe(500_00);
    expect(balance.periods[0]).toMatchObject({
      expectedCents: 1500_00,
      paidCents: 1000_00,
      remainingCents: 500_00,
    });
  });

  test("returns zero due after unrefund restores full paidRent", () => {
    const balance = computeTenantBalanceFromRentSchedule(
      [{ expectedRent: 1500, paidRent: 1500, periodKey: "2026-01" }],
      "2026-01"
    );

    expect(balance.amountDueCents).toBe(0);
    expect(balance.periodMonths).toEqual([]);
  });

  test("returns zero due when schedule month is paid within tolerance", () => {
    const balance = computeTenantBalanceFromRentSchedule(
      [{ expectedRent: 1500, paidRent: 1499.99, periodKey: "2026-01" }],
      "2026-01"
    );

    expect(balance.amountDueCents).toBe(0);
    expect(balance.periodMonths).toEqual([]);
    expect(balance.periods[0]).toMatchObject({
      paidCents: 149_999,
      remainingCents: 0,
    });
  });

  test("reflects partial Stripe allocation already included in paidRent", () => {
    const balance = computeTenantBalanceFromRentSchedule(
      [{ expectedRent: 1500, paidRent: 500, periodKey: "2026-01" }],
      "2026-01"
    );

    expect(balance.amountDueCents).toBe(1000_00);
    expect(balance.periods[0]).toMatchObject({
      expectedCents: 1500_00,
      paidCents: 500_00,
      remainingCents: 1000_00,
    });
  });

  test("sums remaining cents for due weeks using today as asOf", () => {
    const balance = computeTenantBalanceFromRentSchedule(
      [
        { expectedRent: 700, paidRent: 0, periodKey: "2026-01-15" },
        { expectedRent: 700, paidRent: 0, periodKey: "2026-01-22" },
        { expectedRent: 700, paidRent: 0, periodKey: "2026-01-29" },
      ],
      "2026-01-22"
    );

    expect(balance.amountDueCents).toBe(1400_00);
    expect(balance.periodMonths).toEqual(["2026-01-15", "2026-01-22"]);
  });

  test("excludes upcoming weeks beyond asOf reference date", () => {
    const balance = computeTenantBalanceFromRentSchedule(
      [
        { expectedRent: 700, paidRent: 0, periodKey: "2026-01-15" },
        { expectedRent: 700, paidRent: 0, periodKey: "2026-01-29" },
      ],
      "2026-01-18"
    );

    expect(balance.amountDueCents).toBe(700_00);
    expect(balance.periodMonths).toEqual(["2026-01-15"]);
  });
});
