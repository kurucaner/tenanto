import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { IPropertyStripeAccount } from "@/db/property-stripe-accounts";
import { TenantLeaseListStatus } from "@/packages/shared";

const mockListLeases = mock((_tenantUserId: string, _status: string) => Promise.resolve([]));
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
const mockFindStripeAccount = mock(() =>
  Promise.resolve({
    chargesEnabled: true,
    detailsSubmitted: true,
    onboardingComplete: true,
    payoutsEnabled: true,
    propertyId: "property-1",
    stripeAccountId: "acct_1",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as IPropertyStripeAccount | null)
);
const mockSumSucceededByMonths = mock(() => Promise.resolve(new Map<string, number>()));

mock.module("@/services/tenant-portal-access", () => ({
  assertLeaseTenantAccess: mock(() => Promise.resolve({})),
  assertLeaseTenantReadAccess: mock(() => Promise.resolve({})),
  TenantLeaseAccessDeniedError: class extends Error {
    name = "TenantLeaseAccessDeniedError";
  },
}));

mock.module("@/services/tenant-portal-membership-service", () => ({
  tenantPortalMembershipService: {
    listLeases: mockListLeases,
  },
}));

mock.module("@/db/property-long-stays", () => ({
  propertyLongStaysDb: {
    findById: mockFindLeaseById,
    getRentSchedule: mockGetRentSchedule,
  },
}));

mock.module("@/db/property-stripe-accounts", () => ({
  propertyStripeAccountsDb: {
    findByPropertyId: mockFindStripeAccount,
  },
  toConnectStatusResponse: () => ({
    chargesEnabled: false,
    detailsSubmitted: false,
    onboardingComplete: false,
    payoutsEnabled: false,
    stripeAccountId: null,
  }),
}));

mock.module("@/db/tenant-rent-payments", () => ({
  tenantRentPaymentsDb: {
    sumSucceededAllocatedCentsByMonths: mockSumSucceededByMonths,
  },
}));

mock.module("@/stripe/stripe-client", () => ({
  getStripeClient: () => ({}),
  isStripeSecretConfigured: () => true,
}));

mock.module("@/services/winston", () => ({
  WinstonLogger: {
    error: mock(() => undefined),
    info: mock(() => undefined),
    warn: mock(() => undefined),
  },
}));

const { tenantRentPaymentService } = await import("./tenant-rent-payment-service");

describe("tenantRentPaymentService.getRentSummary", () => {
  beforeEach(() => {
    mockListLeases.mockReset();
    mockFindLeaseById.mockClear();
    mockGetRentSchedule.mockClear();
    mockFindStripeAccount.mockClear();
    mockSumSucceededByMonths.mockClear();
    mockSumSucceededByMonths.mockResolvedValue(new Map());
  });

  test("sets hasActiveLease and hasPastLeases from membership lists", async () => {
    mockListLeases.mockImplementation((_tenantUserId: string, status: string) => {
      if (status === TenantLeaseListStatus.ACTIVE) {
        return Promise.resolve([
          {
            leaseId: "lease-1",
            propertyName: "A",
            unitLabel: "1",
          },
        ]);
      }
      return Promise.resolve([
        {
          leaseId: "lease-past",
          propertyName: "B",
          unitLabel: "2",
        },
      ]);
    });

    const summary = await tenantRentPaymentService.getRentSummary("tenant-1");

    expect(summary.hasActiveLease).toBe(true);
    expect(summary.hasPastLeases).toBe(true);
    expect(summary.leases).toHaveLength(1);
    expect(summary.leases[0]?.leaseId).toBe("lease-1");
    expect(summary.totalAmountDueCents).toBe(200_00);
  });

  test("flags false when tenant has no leases", async () => {
    mockListLeases.mockResolvedValue([]);

    const summary = await tenantRentPaymentService.getRentSummary("tenant-1");

    expect(summary).toEqual({
      currency: "usd",
      hasActiveLease: false,
      hasPastLeases: false,
      leases: [],
      totalAmountDueCents: 0,
    });
  });
});
