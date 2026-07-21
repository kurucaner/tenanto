import { describe, expect, test } from "bun:test";

import {
  LEASE_UPCOMING_RENT_PERIOD_ERROR,
  resolveLeaseIncomeRentPeriodKey,
} from "./lease-income-rent-period";

const SCHEDULE_MONTHS = ["2026-01", "2026-02", "2026-03"];

describe("resolveLeaseIncomeRentPeriodKey", () => {
  test("defaults to transactionDate month when rentPeriodKey is omitted", () => {
    expect(
      resolveLeaseIncomeRentPeriodKey({
        scheduleMonths: SCHEDULE_MONTHS,
        transactionDate: "2026-02-15",
      })
    ).toEqual({ ok: true, value: "2026-02" });
  });

  test("uses explicit rentPeriodKey when provided", () => {
    expect(
      resolveLeaseIncomeRentPeriodKey({
        rentPeriodKey: "2026-01",
        scheduleMonths: SCHEDULE_MONTHS,
        transactionDate: "2026-02-15",
      })
    ).toEqual({ ok: true, value: "2026-01" });
  });

  test("rejects invalid rentPeriodKey format", () => {
    expect(
      resolveLeaseIncomeRentPeriodKey({
        rentPeriodKey: "2026-13",
        scheduleMonths: SCHEDULE_MONTHS,
        transactionDate: "2026-02-15",
      })
    ).toEqual({ error: "rentPeriodKey must be YYYY-MM or YYYY-MM-DD", ok: false });
  });

  test("rejects rentPeriodKey outside lease schedule", () => {
    expect(
      resolveLeaseIncomeRentPeriodKey({
        rentPeriodKey: "2026-04",
        scheduleMonths: SCHEDULE_MONTHS,
        transactionDate: "2026-02-15",
      })
    ).toEqual({
      error: "rentPeriodKey must be a period in the lease rent schedule",
      ok: false,
    });
  });

  test("rejects default month when transactionDate is outside schedule", () => {
    expect(
      resolveLeaseIncomeRentPeriodKey({
        scheduleMonths: SCHEDULE_MONTHS,
        transactionDate: "2026-04-01",
      })
    ).toEqual({
      error: "transactionDate falls outside the lease rent schedule; set rentPeriodKey",
      ok: false,
    });
  });

  test("allows due-month attribution when rentPeriodKey is on or before asOfMonth", () => {
    expect(
      resolveLeaseIncomeRentPeriodKey({
        asOfMonth: "2026-02",
        rentPeriodKey: "2026-01",
        scheduleMonths: SCHEDULE_MONTHS,
        transactionDate: "2026-02-15",
      })
    ).toEqual({ ok: true, value: "2026-01" });
  });

  test("defaults omitted rentPeriodKey to transactionDate month when due", () => {
    expect(
      resolveLeaseIncomeRentPeriodKey({
        asOfMonth: "2026-02",
        scheduleMonths: SCHEDULE_MONTHS,
        transactionDate: "2026-02-15",
      })
    ).toEqual({ ok: true, value: "2026-02" });
  });

  test("rejects upcoming rentPeriodKey even when it is on the lease schedule", () => {
    expect(
      resolveLeaseIncomeRentPeriodKey({
        asOfMonth: "2026-02",
        rentPeriodKey: "2026-03",
        scheduleMonths: SCHEDULE_MONTHS,
        transactionDate: "2026-02-15",
      })
    ).toEqual({ error: LEASE_UPCOMING_RENT_PERIOD_ERROR, ok: false });
  });

  test("rejects defaulted transactionDate month when it is upcoming", () => {
    expect(
      resolveLeaseIncomeRentPeriodKey({
        asOfMonth: "2026-02",
        scheduleMonths: SCHEDULE_MONTHS,
        transactionDate: "2026-03-01",
      })
    ).toEqual({ error: LEASE_UPCOMING_RENT_PERIOD_ERROR, ok: false });
  });

  test("skips upcoming check when asOfMonth is omitted", () => {
    expect(
      resolveLeaseIncomeRentPeriodKey({
        rentPeriodKey: "2026-03",
        scheduleMonths: SCHEDULE_MONTHS,
        transactionDate: "2026-02-15",
      })
    ).toEqual({ ok: true, value: "2026-03" });
  });

  test("accepts legacy rentPeriodMonth when rentPeriodKey is omitted", () => {
    expect(
      resolveLeaseIncomeRentPeriodKey({
        rentPeriodMonth: "2026-01",
        scheduleMonths: SCHEDULE_MONTHS,
        transactionDate: "2026-02-15",
      })
    ).toEqual({ ok: true, value: "2026-01" });
  });
});
