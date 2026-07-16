import { describe, expect, test } from "bun:test";

import { resolveLeaseIncomeRentPeriodMonth } from "./lease-income-rent-period";

const SCHEDULE_MONTHS = ["2026-01", "2026-02", "2026-03"];

describe("resolveLeaseIncomeRentPeriodMonth", () => {
  test("defaults to transactionDate month when rentPeriodMonth is omitted", () => {
    expect(
      resolveLeaseIncomeRentPeriodMonth({
        scheduleMonths: SCHEDULE_MONTHS,
        transactionDate: "2026-02-15",
      })
    ).toEqual({ ok: true, value: "2026-02" });
  });

  test("uses explicit rentPeriodMonth when provided", () => {
    expect(
      resolveLeaseIncomeRentPeriodMonth({
        rentPeriodMonth: "2026-01",
        scheduleMonths: SCHEDULE_MONTHS,
        transactionDate: "2026-02-15",
      })
    ).toEqual({ ok: true, value: "2026-01" });
  });

  test("rejects invalid rentPeriodMonth format", () => {
    expect(
      resolveLeaseIncomeRentPeriodMonth({
        rentPeriodMonth: "2026-13",
        scheduleMonths: SCHEDULE_MONTHS,
        transactionDate: "2026-02-15",
      })
    ).toEqual({ error: "rentPeriodMonth must be YYYY-MM", ok: false });
  });

  test("rejects rentPeriodMonth outside lease schedule", () => {
    expect(
      resolveLeaseIncomeRentPeriodMonth({
        rentPeriodMonth: "2026-04",
        scheduleMonths: SCHEDULE_MONTHS,
        transactionDate: "2026-02-15",
      })
    ).toEqual({
      error: "rentPeriodMonth must be a month in the lease rent schedule",
      ok: false,
    });
  });

  test("rejects default month when transactionDate is outside schedule", () => {
    expect(
      resolveLeaseIncomeRentPeriodMonth({
        scheduleMonths: SCHEDULE_MONTHS,
        transactionDate: "2026-04-01",
      })
    ).toEqual({
      error: "transactionDate falls outside the lease rent schedule; set rentPeriodMonth",
      ok: false,
    });
  });
});
