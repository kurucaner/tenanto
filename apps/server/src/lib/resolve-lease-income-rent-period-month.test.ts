import { describe, expect, mock, test } from "bun:test";

import { makeLongStay } from "@/test-fixtures/domain";

const mockFindById = mock(() =>
  Promise.resolve(
    makeLongStay({
      guestName: "Tenant",
      leaseEndDate: "2026-03-31",
      leaseStartDate: "2026-01-01",
      monthlyRent: 1500,
      propertyId: "prop-1",
      tenantEmail: null,
      termMonths: 3,
    })
  )
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

  test("rejects upcoming rentPeriodMonth on an active lease", async () => {
    const result = await resolveLeaseIncomeRentPeriodMonthForLongStay({
      longStayId: "lease-1",
      referenceDate: "2026-02-15",
      rentPeriodMonth: "2026-03",
      transactionDate: "2026-02-10",
    });

    expect(result).toEqual({
      error: "Cannot record rent for an upcoming lease month",
      ok: false,
    });
  });

  test("allows due-month resolution for partial rent recording", async () => {
    const result = await resolveLeaseIncomeRentPeriodMonthForLongStay({
      longStayId: "lease-1",
      referenceDate: "2026-02-15",
      rentPeriodMonth: "2026-02",
      transactionDate: "2026-02-10",
    });

    expect(result).toEqual({ ok: true, value: "2026-02" });
  });
});
