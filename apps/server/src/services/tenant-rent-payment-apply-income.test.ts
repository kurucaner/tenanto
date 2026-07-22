import { beforeEach, describe, expect, mock, test } from "bun:test";

import { TenantRentPaymentStatus } from "@/packages/shared";
import { makePayment } from "@/test-fixtures/domain";
import { mockAsyncFn, mockResolvedEmpty } from "@/test-fixtures/mocks";

const mockListAllocations = mockAsyncFn(() =>
  Promise.resolve(
    [] as Array<{
      allocatedCents: number;
      expectedCentsSnapshot: number;
      periodMonth: string;
    }>
  )
);
const mockFindLeaseById = mockAsyncFn(() =>
  Promise.resolve({
    id: "lease-1",
    propertyId: "property-1",
    unitId: "unit-1",
  } as { id: string; propertyId: string; unitId: string } | null)
);
const mockListActiveByTenantRentPaymentId = mockResolvedEmpty<{
  id: string;
  rentPeriodKey: string | null;
  tenantRentPaymentId: string | null;
}>();
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
    listActiveByTenantRentPaymentId: mockListActiveByTenantRentPaymentId,
  },
}));

mock.module("@/db/tenant-rent-payments", () => ({
  tenantRentPaymentsDb: {
    listAllocations: mockListAllocations,
  },
}));

const { applyIncomeForFullyCoveredMonths } = await import("./tenant-rent-payment-service");

describe("applyIncomeForFullyCoveredMonths", () => {
  beforeEach(() => {
    mockListAllocations.mockClear();
    mockFindLeaseById.mockClear();
    mockListActiveByTenantRentPaymentId.mockClear();
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
    mockFindLeaseById.mockResolvedValue({
      id: "lease-1",
      propertyId: "property-1",
      unitId: "unit-1",
    });
    mockListActiveByTenantRentPaymentId.mockResolvedValue([]);
    mockEnsureLeaseRentIncomeLineType.mockResolvedValue({
      id: "type-system-rent",
      name: "Long-term rent",
      propertyId: "property-1",
      sortOrder: -1,
    });
  });

  test("creates income for allocatedCents when Stripe covers the full period", async () => {
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
        amount: 200,
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

  test("creates income for Stripe remainder when period already has Record Rent", async () => {
    mockListAllocations.mockResolvedValueOnce([
      {
        allocatedCents: 100_00,
        expectedCentsSnapshot: 200_00,
        periodMonth: "2026-01",
      },
    ]);

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
        amount: 100,
        rentPeriodKey: "2026-01",
        tenantRentPaymentId: "payment-1",
      }),
      expect.any(Object)
    );
  });

  test("skips create when this payment already has income for the period", async () => {
    mockListActiveByTenantRentPaymentId.mockResolvedValueOnce([
      {
        id: "line-existing",
        rentPeriodKey: "2026-01",
        tenantRentPaymentId: "payment-1",
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

  test("skips allocations with zero allocated cents", async () => {
    mockListAllocations.mockResolvedValueOnce([
      {
        allocatedCents: 0,
        expectedCentsSnapshot: 200_00,
        periodMonth: "2026-01",
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
        amount: 700,
        rentPeriodKey: "2026-01-15",
        transactionDate: "2026-01-15",
      }),
      expect.any(Object)
    );
  });
});
