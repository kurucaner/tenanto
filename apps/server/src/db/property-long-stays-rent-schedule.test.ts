import { describe, expect, mock, test } from "bun:test";

import { PropertyLongStayStatus } from "@/packages/shared";
import { buildRentScheduleIncomeLineRow, buildRentScheduleLeaseRow } from "@/test-fixtures/db-rows";

const capturedIncomeSql: string[] = [];

type TLeaseRow = Record<string, unknown>;

let currentLeaseRow: TLeaseRow;
let currentIncomeRows: Record<string, unknown>[] = [];
let currentRentPeriodRows: Record<string, unknown>[] = [];
let currentAllocationRows: Array<{ month: string; total: number }> = [];

const mockQuery = mock((sql: string) => {
  if (sql.includes("FROM property_income_lines")) {
    capturedIncomeSql.push(sql);
    return Promise.resolve({ rows: currentIncomeRows });
  }

  if (sql.includes("FROM tenant_rent_payment_allocations")) {
    return Promise.resolve({
      rows: currentAllocationRows.map((row) => ({
        month: row.month,
        total: row.total,
      })),
    });
  }

  if (sql.includes("FROM property_long_stay_rent_periods")) {
    return Promise.resolve({ rows: currentRentPeriodRows });
  }

  if (sql.includes("FROM property_long_stays")) {
    return Promise.resolve({ rows: [currentLeaseRow] });
  }

  return Promise.resolve({ rows: [] });
});

mock.module("./pool", () => ({
  pool: { query: mockQuery },
}));

mock.module("./tenant-rent-payments", () => ({
  tenantRentPaymentsDb: {
    sumSucceededAllocatedCentsByMonths: (_leaseId: string, months: string[]) => {
      const totals = new Map<string, number>();
      for (const row of currentAllocationRows) {
        if (months.includes(row.month)) {
          totals.set(row.month, row.total);
        }
      }
      return Promise.resolve(totals);
    },
  },
}));

const { propertyLongStaysDb } = await import("./property-long-stays");

describe("propertyLongStaysDb.getRentSchedule", () => {
  test("partial refund leaves month unpaid with paid and remaining amounts", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow();
    currentIncomeRows = [
      buildRentScheduleIncomeLineRow({
        id: "line-partial-jan",
        refunded_amount: "500.00",
        refunded_at: new Date("2026-03-01T00:00:00.000Z"),
        transaction_date: "2026-01-15",
      }),
      buildRentScheduleIncomeLineRow({
        id: "line-full-feb",
        refunded_amount: "1500.00",
        refunded_at: new Date("2026-03-01T00:00:00.000Z"),
        transaction_date: "2026-02-15",
      }),
      buildRentScheduleIncomeLineRow({
        id: "line-paid-mar",
        transaction_date: "2026-03-15",
      }),
    ];
    currentRentPeriodRows = [];
    currentAllocationRows = [];
    capturedIncomeSql.length = 0;
    mockQuery.mockClear();

    const schedule = await propertyLongStaysDb.getRentSchedule("lease-1", "2026-03-15");

    expect(capturedIncomeSql).toHaveLength(1);
    expect(capturedIncomeSql[0]).not.toContain("refunded_at IS NULL");

    const january = schedule.find((month) => month.month === "2026-01");
    const february = schedule.find((month) => month.month === "2026-02");
    const march = schedule.find((month) => month.month === "2026-03");

    expect(january).toMatchObject({
      expectedRent: 1500,
      incomeLineId: "line-partial-jan",
      isPaid: false,
      isProrated: false,
      paidRent: 1000,
      remainingRent: 500,
    });
    expect(february).toMatchObject({
      expectedRent: 1500,
      isPaid: false,
      isProrated: false,
      paidRent: 0,
      remainingRent: 1500,
    });
    expect(february?.incomeLineId).toBeUndefined();
    expect(march).toMatchObject({
      expectedRent: 1500,
      incomeLineId: "line-paid-mar",
      isPaid: true,
      isProrated: false,
      paidRent: 1500,
      remainingRent: 0,
    });
  });

  test("prorates the first month when the lease starts mid-month", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow({
      id: "lease-mid-start",
      lease_end_date: "2024-12-31",
      lease_start_date: "2024-06-16",
      rent_amount: "1000.00",
      term_months: 12,
    });
    currentIncomeRows = [];
    currentRentPeriodRows = [];

    const schedule = await propertyLongStaysDb.getRentSchedule("lease-mid-start", "2024-12-31");

    expect(schedule.find((month) => month.month === "2024-06")).toMatchObject({
      daysInMonth: 30,
      expectedRent: 500,
      isPaid: false,
      isProrated: true,
      month: "2024-06",
      occupiedDays: 15,
      paidRent: 0,
      remainingRent: 500,
    });
    expect(schedule.find((month) => month.month === "2024-07")).toMatchObject({
      expectedRent: 1000,
      isProrated: false,
    });
  });

  test("prorates the last month for an early ended lease", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow({
      actual_end_date: "2024-07-15",
      id: "lease-early-end",
      lease_end_date: "2024-12-31",
      lease_start_date: "2024-01-01",
      rent_amount: "1000.00",
      status: PropertyLongStayStatus.ENDED,
      term_months: 12,
    });
    currentIncomeRows = [];
    currentRentPeriodRows = [];

    const schedule = await propertyLongStaysDb.getRentSchedule("lease-early-end", "2024-07-15");

    expect(schedule.map((month) => month.month)).toEqual([
      "2024-01",
      "2024-02",
      "2024-03",
      "2024-04",
      "2024-05",
      "2024-06",
      "2024-07",
    ]);
    expect(schedule.find((month) => month.month === "2024-07")).toMatchObject({
      daysInMonth: 31,
      expectedRent: 483.87,
      isPaid: false,
      isProrated: true,
      month: "2024-07",
      occupiedDays: 15,
      paidRent: 0,
      remainingRent: 483.87,
    });
  });

  test("prorates holdover days after lease end for an ended lease", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow({
      actual_end_date: "2024-07-05",
      id: "lease-holdover",
      lease_end_date: "2024-06-30",
      lease_start_date: "2024-01-01",
      rent_amount: "1000.00",
      status: PropertyLongStayStatus.ENDED,
      term_months: 6,
    });
    currentIncomeRows = [];
    currentRentPeriodRows = [];

    const schedule = await propertyLongStaysDb.getRentSchedule("lease-holdover", "2024-07-05");

    expect(schedule.find((month) => month.month === "2024-06")).toMatchObject({
      expectedRent: 1000,
      isProrated: false,
    });
    expect(schedule.find((month) => month.month === "2024-07")).toMatchObject({
      daysInMonth: 31,
      expectedRent: 161.29,
      isPaid: false,
      isProrated: true,
      month: "2024-07",
      occupiedDays: 5,
      paidRent: 0,
      remainingRent: 161.29,
    });
  });

  test("projects holdover through today for an active overdue lease", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow({
      id: "lease-active-holdover",
      lease_end_date: "2024-06-30",
      lease_start_date: "2024-01-01",
      rent_amount: "1000.00",
      status: PropertyLongStayStatus.ACTIVE,
      term_months: 6,
    });
    currentIncomeRows = [];
    currentRentPeriodRows = [];

    const schedule = await propertyLongStaysDb.getRentSchedule(
      "lease-active-holdover",
      "2024-07-09"
    );

    expect(schedule.map((month) => month.month)).toEqual([
      "2024-01",
      "2024-02",
      "2024-03",
      "2024-04",
      "2024-05",
      "2024-06",
      "2024-07",
    ]);
    expect(schedule.find((month) => month.month === "2024-07")).toMatchObject({
      daysInMonth: 31,
      expectedRent: 290.32,
      isPaid: false,
      isProrated: true,
      month: "2024-07",
      occupiedDays: 9,
      paidRent: 0,
      remainingRent: 290.32,
    });
  });

  test("uses the rent period rate when prorating after a mid-lease increase", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow({
      id: "lease-rent-change",
      lease_end_date: "2024-12-31",
      lease_start_date: "2024-06-16",
      rent_amount: "1000.00",
      term_months: 12,
    });
    currentIncomeRows = [];
    currentRentPeriodRows = [
      {
        effective_from_period: "2024-07",
        rent_amount: "1200.00",
      },
    ];

    const schedule = await propertyLongStaysDb.getRentSchedule("lease-rent-change", "2024-12-31");

    expect(schedule.find((month) => month.month === "2024-06")).toMatchObject({
      expectedRent: 500,
      isProrated: true,
    });
    expect(schedule.find((month) => month.month === "2024-07")).toMatchObject({
      expectedRent: 1200,
      isProrated: false,
    });
  });

  test("prorates an extended lease final month using the rent period rate for that month", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow({
      actual_end_date: "2025-06-15",
      id: "lease-extended-partial-end",
      lease_end_date: "2025-06-15",
      lease_start_date: "2024-06-16",
      rent_amount: "1200.00",
      status: PropertyLongStayStatus.ENDED,
      term_months: 12,
    });
    currentIncomeRows = [];
    currentRentPeriodRows = [
      {
        effective_from_period: "2024-07",
        rent_amount: "1000.00",
      },
      {
        effective_from_period: "2025-06",
        rent_amount: "1200.00",
      },
    ];

    const schedule = await propertyLongStaysDb.getRentSchedule(
      "lease-extended-partial-end",
      "2025-06-15"
    );

    expect(schedule.find((month) => month.month === "2025-06")).toMatchObject({
      daysInMonth: 30,
      expectedRent: 600,
      isPaid: false,
      isProrated: true,
      month: "2025-06",
      occupiedDays: 15,
      paidRent: 0,
      remainingRent: 600,
    });
  });

  test("prorated partial refund leaves month unpaid when reportable rent is short", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow({
      id: "lease-prorated-refund",
      lease_end_date: "2024-12-31",
      lease_start_date: "2024-06-16",
      rent_amount: "1000.00",
      term_months: 12,
    });
    currentIncomeRows = [
      buildRentScheduleIncomeLineRow({
        amount: "500.00",
        gross_income: "500.00",
        id: "line-partial-june",
        net_income: "500.00",
        refunded_amount: "200.00",
        refunded_at: new Date("2024-07-01T00:00:00.000Z"),
        transaction_date: "2024-06-20",
      }),
      buildRentScheduleIncomeLineRow({
        amount: "500.00",
        gross_income: "500.00",
        id: "line-refunded-july",
        net_income: "500.00",
        refunded_amount: "500.00",
        refunded_at: new Date("2024-08-01T00:00:00.000Z"),
        transaction_date: "2024-07-20",
      }),
    ];
    currentRentPeriodRows = [];

    const schedule = await propertyLongStaysDb.getRentSchedule(
      "lease-prorated-refund",
      "2024-12-31"
    );

    expect(schedule.find((month) => month.month === "2024-06")).toMatchObject({
      expectedRent: 500,
      incomeLineId: "line-partial-june",
      isPaid: false,
      isProrated: true,
      paidRent: 300,
      remainingRent: 200,
    });
    expect(schedule.find((month) => month.month === "2024-07")).toMatchObject({
      expectedRent: 1000,
      isPaid: false,
      isProrated: false,
      paidRent: 0,
      remainingRent: 1000,
    });
    expect(schedule.find((month) => month.month === "2024-07")?.incomeLineId).toBeUndefined();
  });

  test("full refund marks month unpaid with zero paid rent", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow();
    currentIncomeRows = [
      buildRentScheduleIncomeLineRow({
        id: "line-full-refund-jan",
        refunded_amount: "1500.00",
        refunded_at: new Date("2026-02-01T00:00:00.000Z"),
        rent_period_key: "2026-01",
        transaction_date: "2026-01-15",
      }),
    ];
    currentRentPeriodRows = [];
    currentAllocationRows = [];

    const schedule = await propertyLongStaysDb.getRentSchedule("lease-1", "2026-03-15");
    const january = schedule.find((month) => month.month === "2026-01");

    expect(january).toMatchObject({
      expectedRent: 1500,
      isPaid: false,
      paidRent: 0,
      remainingRent: 1500,
    });
    expect(january?.incomeLineId).toBeUndefined();
  });

  test("partial refund then re-recording completes the month", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow();
    currentRentPeriodRows = [];
    currentAllocationRows = [];

    currentIncomeRows = [
      buildRentScheduleIncomeLineRow({
        id: "line-paid-jan",
        rent_period_key: "2026-01",
        transaction_date: "2026-01-15",
      }),
    ];

    let schedule = await propertyLongStaysDb.getRentSchedule("lease-1", "2026-03-15");
    expect(schedule.find((month) => month.month === "2026-01")).toMatchObject({
      isPaid: true,
      paidRent: 1500,
      remainingRent: 0,
    });

    currentIncomeRows = [
      buildRentScheduleIncomeLineRow({
        id: "line-paid-jan",
        refunded_amount: "500.00",
        refunded_at: new Date("2026-02-01T00:00:00.000Z"),
        rent_period_key: "2026-01",
        transaction_date: "2026-01-15",
      }),
    ];

    schedule = await propertyLongStaysDb.getRentSchedule("lease-1", "2026-03-15");
    expect(schedule.find((month) => month.month === "2026-01")).toMatchObject({
      incomeLineId: "line-paid-jan",
      isPaid: false,
      paidRent: 1000,
      remainingRent: 500,
    });

    currentIncomeRows = [
      buildRentScheduleIncomeLineRow({
        id: "line-paid-jan",
        refunded_amount: "500.00",
        refunded_at: new Date("2026-02-01T00:00:00.000Z"),
        rent_period_key: "2026-01",
        transaction_date: "2026-01-15",
      }),
      buildRentScheduleIncomeLineRow({
        amount: "500.00",
        gross_income: "500.00",
        id: "line-rerecord-jan",
        net_income: "500.00",
        rent_period_key: "2026-01",
        transaction_date: "2026-02-10",
      }),
    ];

    schedule = await propertyLongStaysDb.getRentSchedule("lease-1", "2026-03-15");
    expect(schedule.find((month) => month.month === "2026-01")).toMatchObject({
      incomeLineId: "line-paid-jan",
      isPaid: true,
      paidRent: 1500,
      remainingRent: 0,
    });
  });

  test("unrefund restores fully paid month after partial refund", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow();
    currentRentPeriodRows = [];
    currentAllocationRows = [];

    currentIncomeRows = [
      buildRentScheduleIncomeLineRow({
        id: "line-refunded-jan",
        refunded_amount: "500.00",
        refunded_at: new Date("2026-02-01T00:00:00.000Z"),
        rent_period_key: "2026-01",
        transaction_date: "2026-01-15",
      }),
    ];

    let schedule = await propertyLongStaysDb.getRentSchedule("lease-1", "2026-03-15");
    expect(schedule.find((month) => month.month === "2026-01")).toMatchObject({
      isPaid: false,
      paidRent: 1000,
      remainingRent: 500,
    });

    currentIncomeRows = [
      buildRentScheduleIncomeLineRow({
        id: "line-refunded-jan",
        rent_period_key: "2026-01",
        transaction_date: "2026-01-15",
      }),
    ];

    schedule = await propertyLongStaysDb.getRentSchedule("lease-1", "2026-03-15");
    expect(schedule.find((month) => month.month === "2026-01")).toMatchObject({
      incomeLineId: "line-refunded-jan",
      isPaid: true,
      paidRent: 1500,
      remainingRent: 0,
    });
  });

  test("partial manual payment keeps month unpaid", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow();
    currentIncomeRows = [
      buildRentScheduleIncomeLineRow({
        amount: "750.00",
        gross_income: "750.00",
        id: "line-partial-jan",
        net_income: "750.00",
        transaction_date: "2026-01-15",
      }),
    ];
    currentRentPeriodRows = [];
    currentAllocationRows = [];

    const schedule = await propertyLongStaysDb.getRentSchedule("lease-1", "2026-03-15");
    const january = schedule.find((month) => month.month === "2026-01");

    expect(january).toMatchObject({
      expectedRent: 1500,
      incomeLineId: "line-partial-jan",
      isPaid: false,
      paidRent: 750,
      remainingRent: 750,
    });
  });

  test("two partial income lines sum to fully paid month", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow();
    currentIncomeRows = [
      buildRentScheduleIncomeLineRow({
        amount: "750.00",
        gross_income: "750.00",
        id: "line-partial-a",
        net_income: "750.00",
        transaction_date: "2026-01-10",
      }),
      buildRentScheduleIncomeLineRow({
        amount: "750.00",
        gross_income: "750.00",
        id: "line-partial-b",
        net_income: "750.00",
        transaction_date: "2026-01-20",
      }),
    ];
    currentRentPeriodRows = [];
    currentAllocationRows = [];

    const schedule = await propertyLongStaysDb.getRentSchedule("lease-1", "2026-03-15");
    const january = schedule.find((month) => month.month === "2026-01");

    expect(january).toMatchObject({
      expectedRent: 1500,
      incomeLineId: "line-partial-a",
      isPaid: true,
      paidRent: 1500,
      remainingRent: 0,
    });
  });

  test("two $750 manual lines with rentPeriodMonth mark month paid", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow();
    currentIncomeRows = [
      buildRentScheduleIncomeLineRow({
        amount: "750.00",
        gross_income: "750.00",
        id: "line-partial-a",
        net_income: "750.00",
        rent_period_key: "2026-01",
        transaction_date: "2026-01-10",
      }),
      buildRentScheduleIncomeLineRow({
        amount: "750.00",
        gross_income: "750.00",
        id: "line-partial-b",
        net_income: "750.00",
        rent_period_key: "2026-01",
        transaction_date: "2026-01-20",
      }),
    ];
    currentRentPeriodRows = [];
    currentAllocationRows = [];

    const schedule = await propertyLongStaysDb.getRentSchedule("lease-1", "2026-03-15");
    const january = schedule.find((month) => month.month === "2026-01");

    expect(january).toMatchObject({
      expectedRent: 1500,
      incomeLineId: "line-partial-a",
      isPaid: true,
      paidRent: 1500,
      remainingRent: 0,
    });
  });

  test("manual partial plus Stripe partial combine without exceeding expected rent", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow();
    currentIncomeRows = [
      buildRentScheduleIncomeLineRow({
        amount: "500.00",
        gross_income: "500.00",
        id: "line-manual-jan",
        net_income: "500.00",
        rent_period_key: "2026-01",
        transaction_date: "2026-01-10",
      }),
    ];
    currentRentPeriodRows = [];
    currentAllocationRows = [{ month: "2026-01", total: 50_000 }];

    let schedule = await propertyLongStaysDb.getRentSchedule("lease-1", "2026-03-15");
    expect(schedule.find((month) => month.month === "2026-01")).toMatchObject({
      incomeLineId: "line-manual-jan",
      isPaid: false,
      paidRent: 1000,
      remainingRent: 500,
    });

    currentAllocationRows = [{ month: "2026-01", total: 120_000 }];

    schedule = await propertyLongStaysDb.getRentSchedule("lease-1", "2026-03-15");
    expect(schedule.find((month) => month.month === "2026-01")).toMatchObject({
      incomeLineId: "line-manual-jan",
      isPaid: true,
      paidRent: 1500,
      remainingRent: 0,
    });
  });

  test("includes succeeded Stripe allocations in rollup", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow();
    currentIncomeRows = [];
    currentRentPeriodRows = [];
    currentAllocationRows = [{ month: "2026-01", total: 50_000 }];

    const schedule = await propertyLongStaysDb.getRentSchedule("lease-1", "2026-03-15");
    const january = schedule.find((month) => month.month === "2026-01");

    expect(january).toMatchObject({
      expectedRent: 1500,
      isPaid: false,
      paidRent: 500,
      remainingRent: 1000,
    });
    expect(january?.incomeLineId).toBeUndefined();
  });

  test("uses a custom contract end date without an extra partial month after the last full month", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow({
      id: "lease-custom-end",
      lease_end_date: "2027-06-30",
      lease_start_date: "2026-07-01",
      rent_amount: "1000.00",
      term_months: 12,
    });
    currentIncomeRows = [];
    currentRentPeriodRows = [];
    currentAllocationRows = [];

    const schedule = await propertyLongStaysDb.getRentSchedule("lease-custom-end", "2027-06-30");

    expect(schedule.map((month) => month.month)).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
      "2027-03",
      "2027-04",
      "2027-05",
      "2027-06",
    ]);
    expect(schedule.every((month) => month.isProrated === false)).toBe(true);
    expect(schedule.every((month) => month.expectedRent === 1000)).toBe(true);
  });

  test("refunded Stripe-linked income marks month unpaid when allocations are excluded", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow();
    currentIncomeRows = [
      buildRentScheduleIncomeLineRow({
        id: "line-stripe-jan",
        refunded_amount: "1500.00",
        refunded_at: new Date("2026-02-01T00:00:00.000Z"),
        rent_period_key: "2026-01",
        tenant_rent_payment_id: "payment-1",
        transaction_date: "2026-01-15",
      }),
    ];
    currentRentPeriodRows = [];
    currentAllocationRows = [];

    const schedule = await propertyLongStaysDb.getRentSchedule("lease-1", "2026-03-15");
    const january = schedule.find((month) => month.month === "2026-01");

    expect(january).toMatchObject({
      expectedRent: 1500,
      isPaid: false,
      paidRent: 0,
      remainingRent: 1500,
    });
    expect(january?.incomeLineId).toBeUndefined();
  });

  test("returns weekly schedule with week-start keys and prorated final week", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow({
      id: "lease-weekly",
      lease_end_date: "2026-02-10",
      lease_start_date: "2026-01-15",
      rent_amount: "700.00",
      rent_billing_cadence: "weekly",
      term_months: 1,
    });
    currentIncomeRows = [];
    currentRentPeriodRows = [];

    const schedule = await propertyLongStaysDb.getRentSchedule("lease-weekly", "2026-02-10");

    expect(schedule.map((item) => item.month)).toEqual([
      "2026-01-15",
      "2026-01-22",
      "2026-01-29",
      "2026-02-05",
    ]);
    expect(schedule[0]).toMatchObject({
      expectedRent: 700,
      isProrated: false,
      month: "2026-01-15",
      occupiedDays: 7,
    });
    expect(schedule[3]).toMatchObject({
      expectedRent: 600,
      isProrated: true,
      month: "2026-02-05",
      occupiedDays: 6,
      paidRent: 0,
      remainingRent: 600,
    });
  });

  test("returns weekly schedule with mid-lease rent period change", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow({
      id: "lease-weekly-rate-change",
      lease_end_date: "2026-02-10",
      lease_start_date: "2026-01-15",
      rent_amount: "700.00",
      rent_billing_cadence: "weekly",
      term_months: 1,
    });
    currentIncomeRows = [];
    currentRentPeriodRows = [
      { effective_from_period: "2026-01-15", rent_amount: "700.00" },
      { effective_from_period: "2026-01-29", rent_amount: "800.00" },
    ];

    const schedule = await propertyLongStaysDb.getRentSchedule(
      "lease-weekly-rate-change",
      "2026-02-10"
    );

    expect(schedule[0]?.expectedRent).toBe(700);
    expect(schedule[1]?.expectedRent).toBe(700);
    expect(schedule[2]?.expectedRent).toBe(800);
    expect(schedule[3]).toMatchObject({
      expectedRent: 685.71,
      isProrated: true,
      month: "2026-02-05",
    });
  });

  test("reflects weekly extend rent change across original and extension weeks", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow({
      id: "lease-weekly-extended",
      lease_end_date: "2026-02-04",
      lease_start_date: "2026-01-01",
      rent_amount: "600.00",
      rent_billing_cadence: "weekly",
      term_months: 2,
    });
    currentIncomeRows = [];
    currentRentPeriodRows = [
      { effective_from_period: "2026-01-01", rent_amount: "500.00" },
      { effective_from_period: "2026-01-15", rent_amount: "600.00" },
    ];

    const schedule = await propertyLongStaysDb.getRentSchedule(
      "lease-weekly-extended",
      "2026-02-04"
    );

    expect(schedule.map((item) => item.month)).toEqual([
      "2026-01-01",
      "2026-01-08",
      "2026-01-15",
      "2026-01-22",
      "2026-01-29",
    ]);
    expect(schedule.map((item) => item.expectedRent)).toEqual([500, 500, 600, 600, 600]);
  });
});
