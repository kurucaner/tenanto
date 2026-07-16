import { describe, expect, mock, test } from "bun:test";

import { PropertyLongStayStatus } from "@/packages/shared";

const mockFindById = mock(() =>
  Promise.resolve({
    actualEndDate: null,
    guestName: "Tenant",
    id: "lease-1",
    leaseEndDate: "2026-03-31",
    leaseStartDate: "2026-01-01",
    monthlyRent: 1500,
    propertyId: "prop-1",
    secondaryTenants: [],
    status: PropertyLongStayStatus.ACTIVE,
    tenantEmail: null,
    tenantPhone: null,
    termMonths: 3,
    unitId: "unit-1",
  })
);

mock.module("@/db/property-long-stays", () => ({
  propertyLongStaysDb: {
    findById: mockFindById,
  },
}));

const { resolveLeaseIncomeRentPeriodMonthForLongStay } =
  await import("./resolve-lease-income-rent-period-month");

describe("resolveLeaseIncomeRentPeriodMonthForLongStay", () => {
  test("defaults to transactionDate month within lease schedule", async () => {
    const result = await resolveLeaseIncomeRentPeriodMonthForLongStay({
      longStayId: "lease-1",
      referenceDate: "2026-03-15",
      transactionDate: "2026-02-10",
    });

    expect(result).toEqual({ ok: true, value: "2026-02" });
  });

  test("accepts explicit rentPeriodMonth from schedule", async () => {
    const result = await resolveLeaseIncomeRentPeriodMonthForLongStay({
      longStayId: "lease-1",
      referenceDate: "2026-03-15",
      rentPeriodMonth: "2026-01",
      transactionDate: "2026-02-10",
    });

    expect(result).toEqual({ ok: true, value: "2026-01" });
  });

  test("rejects rentPeriodMonth outside lease schedule", async () => {
    const result = await resolveLeaseIncomeRentPeriodMonthForLongStay({
      longStayId: "lease-1",
      referenceDate: "2026-03-15",
      rentPeriodMonth: "2026-04",
      transactionDate: "2026-02-10",
    });

    expect(result).toEqual({
      error: "rentPeriodMonth must be a month in the lease rent schedule",
      ok: false,
    });
  });
});
