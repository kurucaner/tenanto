import { beforeEach, describe, expect, mock, test } from "bun:test";

import { TenantRentPaymentStatus } from "@/packages/shared";
import { makePayment } from "@/test-fixtures/domain";
import { mockAsyncFn, mockResolved } from "@/test-fixtures/mocks";

const mockListAllocations = mockAsyncFn(() =>
  Promise.resolve(
    [] as Array<{
      allocatedCents: number;
      expectedCentsSnapshot: number;
      periodMonth: string;
    }>
  )
);
const mockSumSucceededAllocatedCents = mockResolved(0);
const mockFindLeaseById = mockAsyncFn(() =>
  Promise.resolve({
    id: "lease-1",
    propertyId: "property-1",
    unitId: "unit-1",
  } as { id: string; propertyId: string; unitId: string } | null)
);
const mockGetRentSchedule = mockAsyncFn(() =>
  Promise.resolve([
    {
      expectedRent: 200,
      isPaid: false,
      month: "2026-01",
      paidRent: 0,
      remainingRent: 200,
    },
  ])
);
const mockEnsureLeaseRentIncomeLineType = mockAsyncFn(() =>
  Promise.resolve({
    id: "type-system-rent",
    name: "Long-term rent",
    propertyId: "property-1",
    sortOrder: -1,
  })
);
const mockEnsureLeaseDepositIncomeLineType = mockAsyncFn(() =>
  Promise.resolve({
    id: "type-system-deposit",
    name: "Security deposit",
    propertyId: "property-1",
    sortOrder: -2,
  })
);
const mockCreateIncomeLine = mockAsyncFn(() =>
  Promise.resolve({
    id: "line-1",
    tenantRentPaymentId: "payment-1",
  })
);

mock.module("@/db/property-long-stays", () => ({
  propertyLongStaysDb: {
    findById: mockFindLeaseById,
    getRentSchedule: mockGetRentSchedule,
  },
}));

mock.module("@/db/property-income-line-types", () => ({
  propertyIncomeLineTypesDb: {
    ensureLeaseDepositIncomeLineType: mockEnsureLeaseDepositIncomeLineType,
    ensureLeaseRentIncomeLineType: mockEnsureLeaseRentIncomeLineType,
  },
}));

mock.module("@/db/property-income-lines", () => ({
  propertyIncomeLinesDb: {
    create: mockCreateIncomeLine,
  },
}));

mock.module("@/db/tenant-rent-payments", () => ({
  tenantRentPaymentsDb: {
    listAllocations: mockListAllocations,
    sumSucceededAllocatedCents: mockSumSucceededAllocatedCents,
  },
}));

const { applyIncomeForFullyCoveredMonths } = await import("./tenant-rent-payment-service");

describe("applyIncomeForFullyCoveredMonths", () => {
  beforeEach(() => {
    mockListAllocations.mockClear();
    mockSumSucceededAllocatedCents.mockClear();
    mockFindLeaseById.mockClear();
    mockGetRentSchedule.mockClear();
    mockEnsureLeaseRentIncomeLineType.mockClear();
    mockEnsureLeaseDepositIncomeLineType.mockClear();
    mockCreateIncomeLine.mockClear();

    mockListAllocations.mockResolvedValue([
      {
        allocatedCents: 200_00,
        expectedCentsSnapshot: 200_00,
        periodMonth: "2026-01",
      },
    ]);
    mockSumSucceededAllocatedCents.mockResolvedValue(200_00);
    mockFindLeaseById.mockResolvedValue({
      id: "lease-1",
      propertyId: "property-1",
      unitId: "unit-1",
    });
    mockGetRentSchedule.mockResolvedValue([
      {
        expectedRent: 200,
        isPaid: false,
        month: "2026-01",
        paidRent: 0,
        remainingRent: 200,
      },
    ]);
    mockEnsureLeaseRentIncomeLineType.mockResolvedValue({
      id: "type-system-rent",
      name: "Long-term rent",
      propertyId: "property-1",
      sortOrder: -1,
    });
  });

  test("creates income with tenantRentPaymentId when month is fully covered", async () => {
    await applyIncomeForFullyCoveredMonths(
      makePayment({
        status: TenantRentPaymentStatus.SUCCEEDED,
        stripeCheckoutSessionId: "cs_1",
        stripePaymentIntentId: "pi_1",
      })
    );

    expect(mockCreateIncomeLine).toHaveBeenCalledTimes(1);
    expect(mockCreateIncomeLine).toHaveBeenCalledWith(
      "property-1",
      expect.objectContaining({
        incomeLineTypeId: "type-system-rent",
        longStayId: "lease-1",
        rentPeriodKey: "2026-01",
        tenantRentPaymentId: "payment-1",
      }),
      expect.any(Object)
    );
  });

  test("uses system lease rent type when user catalog types are empty", async () => {
    await applyIncomeForFullyCoveredMonths(
      makePayment({
        status: TenantRentPaymentStatus.SUCCEEDED,
        stripeCheckoutSessionId: "cs_1",
        stripePaymentIntentId: "pi_1",
      })
    );

    expect(mockEnsureLeaseRentIncomeLineType).toHaveBeenCalledWith("property-1");
    expect(mockEnsureLeaseDepositIncomeLineType).not.toHaveBeenCalled();
    expect(mockCreateIncomeLine).toHaveBeenCalledWith(
      "property-1",
      expect.objectContaining({
        incomeLineTypeId: "type-system-rent",
        longStayId: "lease-1",
      }),
      expect.any(Object)
    );
  });

  test("skips create when schedule month is already paid", async () => {
    mockGetRentSchedule.mockResolvedValueOnce([
      {
        expectedRent: 200,
        isPaid: true,
        month: "2026-01",
        paidRent: 200,
        remainingRent: 0,
      },
    ]);

    await applyIncomeForFullyCoveredMonths(
      makePayment({
        status: TenantRentPaymentStatus.SUCCEEDED,
        stripeCheckoutSessionId: "cs_1",
        stripePaymentIntentId: "pi_1",
      })
    );

    expect(mockCreateIncomeLine).not.toHaveBeenCalled();
  });

  test("creates income with week-start transactionDate for weekly allocations", async () => {
    mockListAllocations.mockResolvedValueOnce([
      {
        allocatedCents: 700_00,
        expectedCentsSnapshot: 700_00,
        periodMonth: "2026-01-15",
      },
    ]);
    mockSumSucceededAllocatedCents.mockResolvedValueOnce(700_00);
    mockGetRentSchedule.mockResolvedValueOnce([
      {
        expectedRent: 700,
        isPaid: false,
        month: "2026-01-15",
        paidRent: 0,
        remainingRent: 700,
      },
    ]);

    await applyIncomeForFullyCoveredMonths(
      makePayment({
        status: TenantRentPaymentStatus.SUCCEEDED,
        stripeCheckoutSessionId: "cs_1",
        stripePaymentIntentId: "pi_1",
      })
    );

    expect(mockCreateIncomeLine).toHaveBeenCalledWith(
      "property-1",
      expect.objectContaining({
        rentPeriodKey: "2026-01-15",
        transactionDate: "2026-01-15",
      }),
      expect.any(Object)
    );
  });
});
