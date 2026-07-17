import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { ITenantRentPayment } from "@/db/tenant-rent-payments";
import { buildRentCheckoutIdempotencyKey, TenantRentPaymentStatus } from "@/packages/shared";

const mockListAllocations = mock(() =>
  Promise.resolve(
    [] as Array<{
      allocatedCents: number;
      expectedCentsSnapshot: number;
      periodMonth: string;
    }>
  )
);
const mockSumSucceededAllocatedCents = mock(() => Promise.resolve(0));
const mockFindLeaseById = mock(() =>
  Promise.resolve({
    id: "lease-1",
    propertyId: "property-1",
    unitId: "unit-1",
  } as { id: string; propertyId: string; unitId: string } | null)
);
const mockGetRentSchedule = mock(() =>
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
const mockFindIncomeLineTypes = mock(() =>
  Promise.resolve([{ id: "type-rent", name: "Rent" }] as Array<{ id: string; name: string }>)
);
const mockCreateIncomeLine = mock(() =>
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
    findByProperty: mockFindIncomeLineTypes,
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

function makePayment(overrides: Partial<ITenantRentPayment> = {}): ITenantRentPayment {
  return {
    amountCents: 200_00,
    connectedAccountId: "acct_1",
    createdAt: "2026-01-01T00:00:00.000Z",
    currency: "usd",
    id: "payment-1",
    idempotencyKey: buildRentCheckoutIdempotencyKey({
      amountCents: 200_00,
      leaseId: "lease-1",
      periodMonths: ["2026-01"],
      tenantUserId: "tenant-1",
    }),
    leaseId: "lease-1",
    propertyId: "property-1",
    status: TenantRentPaymentStatus.SUCCEEDED,
    stripeCheckoutSessionId: "cs_1",
    stripePaymentIntentId: "pi_1",
    tenantUserId: "tenant-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("applyIncomeForFullyCoveredMonths", () => {
  beforeEach(() => {
    mockListAllocations.mockClear();
    mockSumSucceededAllocatedCents.mockClear();
    mockFindLeaseById.mockClear();
    mockGetRentSchedule.mockClear();
    mockFindIncomeLineTypes.mockClear();
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
    mockFindIncomeLineTypes.mockResolvedValue([{ id: "type-rent", name: "Rent" }]);
  });

  test("creates income with tenantRentPaymentId when month is fully covered", async () => {
    await applyIncomeForFullyCoveredMonths(makePayment());

    expect(mockCreateIncomeLine).toHaveBeenCalledTimes(1);
    expect(mockCreateIncomeLine).toHaveBeenCalledWith(
      "property-1",
      expect.objectContaining({
        longStayId: "lease-1",
        rentPeriodMonth: "2026-01",
        tenantRentPaymentId: "payment-1",
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

    await applyIncomeForFullyCoveredMonths(makePayment());

    expect(mockCreateIncomeLine).not.toHaveBeenCalled();
  });
});
