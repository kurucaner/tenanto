import { describe, expect, mock, test } from "bun:test";

import { resolveLeaseIncomeLineTypeId } from "@/packages/shared";
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
  await import("@/lib/resolve-lease-income-rent-period-month");

async function validateCreateLeaseIncomeRentPeriod(input: {
  longStayId: string | null;
  rentPeriodMonth?: string;
  today: string;
  transactionDate: string;
}): Promise<{ ok: true; rentPeriodMonth: string | null } | { error: string; ok: false }> {
  if (input.transactionDate > input.today) {
    return { error: "Transaction date cannot be in the future", ok: false };
  }

  if (!input.longStayId) {
    return { ok: true, rentPeriodMonth: null };
  }

  const resolved = await resolveLeaseIncomeRentPeriodMonthForLongStay({
    longStayId: input.longStayId,
    referenceDate: input.today,
    rentPeriodMonth: input.rentPeriodMonth,
    transactionDate: input.transactionDate,
  });

  if (!resolved.ok) {
    return resolved;
  }

  return { ok: true, rentPeriodMonth: resolved.value };
}

describe("POST /properties/:propertyId/income-lines lease rent validation", () => {
  test("returns 400-style error for future rentPeriodMonth on active lease", async () => {
    const result = await validateCreateLeaseIncomeRentPeriod({
      longStayId: "lease-1",
      rentPeriodMonth: "2026-03",
      today: "2026-02-15",
      transactionDate: "2026-02-10",
    });

    expect(result).toEqual({
      error: "Cannot record rent for an upcoming lease month",
      ok: false,
    });
  });

  test("allows due-month partial rent when rentPeriodMonth is current month", async () => {
    const result = await validateCreateLeaseIncomeRentPeriod({
      longStayId: "lease-1",
      rentPeriodMonth: "2026-02",
      today: "2026-02-15",
      transactionDate: "2026-02-10",
    });

    expect(result).toEqual({ ok: true, rentPeriodMonth: "2026-02" });
  });

  test("allows late payment attribution to a prior due month", async () => {
    const result = await validateCreateLeaseIncomeRentPeriod({
      longStayId: "lease-1",
      rentPeriodMonth: "2026-01",
      today: "2026-02-15",
      transactionDate: "2026-02-10",
    });

    expect(result).toEqual({ ok: true, rentPeriodMonth: "2026-01" });
  });
});

describe("lease rent income line type resolution", () => {
  test("still resolves a type id when Rent was renamed in settings", () => {
    expect(
      resolveLeaseIncomeLineTypeId([
        { id: "type-clean", name: "Extra cleaning" },
        { id: "type-lease", name: "Monthly lease" },
      ])
    ).toBe("type-clean");
  });

  test("prefers Rent by name when the catalog still includes it", () => {
    expect(
      resolveLeaseIncomeLineTypeId([
        { id: "type-clean", name: "Extra cleaning" },
        { id: "type-rent", name: "Rent" },
      ])
    ).toBe("type-rent");
  });
});
