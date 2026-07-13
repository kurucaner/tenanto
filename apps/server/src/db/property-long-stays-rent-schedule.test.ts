import { describe, expect, mock, test } from "bun:test";

import { PropertyLongStayStatus } from "@/packages/shared";

const capturedIncomeSql: string[] = [];

function buildIncomeLineRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    amount: "1500.00",
    channel_commission: "0.00",
    created_at: new Date("2026-01-15T12:00:00.000Z"),
    deleted_at: null,
    description: null,
    gross_income: "1500.00",
    guest_name: null,
    id: "line-rent-jan",
    income_line_type_id: "00000000-0000-4000-8000-000000000031",
    is_deleted: false,
    long_stay_id: "lease-1",
    net_income: "1500.00",
    property_id: "prop-1",
    refunded_amount: null,
    refunded_at: null,
    refunded_by: null,
    reservation_id: null,
    tax_breakdown: "[]",
    transaction_date: "2026-01-15",
    unit_id: "unit-1",
    updated_at: new Date("2026-01-15T12:00:00.000Z"),
    ...overrides,
  };
}

const mockQuery = mock((sql: string) => {
  if (sql.includes("FROM property_income_lines")) {
    capturedIncomeSql.push(sql);
    return Promise.resolve({
      rows: [
        buildIncomeLineRow({
          id: "line-partial-jan",
          refunded_amount: "500.00",
          refunded_at: new Date("2026-03-01T00:00:00.000Z"),
          transaction_date: "2026-01-15",
        }),
        buildIncomeLineRow({
          id: "line-full-feb",
          refunded_amount: "1500.00",
          refunded_at: new Date("2026-03-01T00:00:00.000Z"),
          transaction_date: "2026-02-15",
        }),
        buildIncomeLineRow({
          id: "line-paid-mar",
          transaction_date: "2026-03-15",
        }),
      ],
    });
  }

  if (sql.includes("FROM property_long_stay_rent_periods")) {
    return Promise.resolve({ rows: [] });
  }

  if (sql.includes("FROM property_long_stays")) {
    return Promise.resolve({
      rows: [
        {
          actual_end_date: null,
          created_at: new Date("2026-01-01T00:00:00.000Z"),
          guest_name: "Tenant",
          id: "lease-1",
          lease_end_date: "2026-03-31",
          lease_start_date: "2026-01-01",
          monthly_rent: "1500.00",
          property_id: "prop-1",
          secondary_tenants: [],
          status: PropertyLongStayStatus.ACTIVE,
          tenant_email: null,
          tenant_phone: null,
          term_months: 3,
          unit_id: "unit-1",
          updated_at: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });
  }

  return Promise.resolve({ rows: [] });
});

mock.module("./pool", () => ({
  pool: { query: mockQuery },
}));

const { propertyLongStaysDb } = await import("./property-long-stays");

describe("propertyLongStaysDb.getRentSchedule", () => {
  test("marks months paid when reportable rent remains after partial refund", async () => {
    capturedIncomeSql.length = 0;
    mockQuery.mockClear();

    const schedule = await propertyLongStaysDb.getRentSchedule("lease-1");

    expect(capturedIncomeSql).toHaveLength(1);
    expect(capturedIncomeSql[0]).not.toContain("refunded_at IS NULL");

    const january = schedule.find((month) => month.month === "2026-01");
    const february = schedule.find((month) => month.month === "2026-02");
    const march = schedule.find((month) => month.month === "2026-03");

    expect(january).toMatchObject({ incomeLineId: "line-partial-jan", isPaid: true });
    expect(february?.isPaid).toBe(false);
    expect(february?.incomeLineId).toBeUndefined();
    expect(march).toMatchObject({ incomeLineId: "line-paid-mar", isPaid: true });
  });
});
