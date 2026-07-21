import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { IPropertyStripeAccount } from "@/db/property-stripe-accounts";
import {
  type ITenantLeaseListItem,
  TenantLeaseListStatus,
  TenantMembershipStatus,
} from "@/packages/shared";
import { makeLeaseListItem } from "@/test-fixtures/domain";
import { mockAsyncFn, mockResolved, mockSyncVoid } from "@/test-fixtures/mocks";

const mockListLeases = mockAsyncFn(
  (_tenantUserId: string, _status: string): Promise<ITenantLeaseListItem[]> => Promise.resolve([])
);
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
const mockFindStripeAccount = mockAsyncFn(() =>
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
const mockSumSucceededByMonths = mockResolved(new Map<string, number>());

mock.module("@/services/tenant-portal-access", () => ({
  assertLeaseTenantAccess: mockResolved({}),
  assertLeaseTenantReadAccess: mockResolved({}),
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
    accountType: null,
    chargesEnabled: false,
    detailsSubmitted: false,
    onboardingComplete: false,
    payoutsEnabled: false,
    platformEnabled: true,
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
    error: mockSyncVoid(),
    info: mockSyncVoid(),
    warn: mockSyncVoid(),
  },
}));

mock.module("@/lib/date-utils", () => ({
  getTodayUtcIsoDate: () => "2026-01-22",
}));

const { tenantRentPaymentService } = await import("./tenant-rent-payment-service");

describe("tenantRentPaymentService.getRentSummary", () => {
  const originalStripeConnectEnabled = process.env.STRIPE_CONNECT_ENABLED;

  beforeEach(() => {
    process.env.STRIPE_CONNECT_ENABLED = "true";
    mockListLeases.mockReset();
    mockFindLeaseById.mockClear();
    mockGetRentSchedule.mockClear();
    mockFindStripeAccount.mockClear();
    mockSumSucceededByMonths.mockClear();
    mockSumSucceededByMonths.mockResolvedValue(new Map());
  });

  afterEach(() => {
    if (originalStripeConnectEnabled === undefined) {
      delete process.env.STRIPE_CONNECT_ENABLED;
    } else {
      process.env.STRIPE_CONNECT_ENABLED = originalStripeConnectEnabled;
    }
  });

  test("sets hasActiveLease and hasPastLeases from membership lists", async () => {
    mockListLeases.mockImplementation((_tenantUserId: string, status: string) => {
      if (status === TenantLeaseListStatus.ACTIVE) {
        return Promise.resolve([
          makeLeaseListItem({
            leaseId: "lease-1",
            propertyName: "A",
            unitLabel: "1",
          }),
        ]);
      }
      return Promise.resolve([
        makeLeaseListItem({
          leaseId: "lease-past",
          propertyName: "B",
          status: TenantMembershipStatus.ENDED,
          unitLabel: "2",
        }),
      ]);
    });

    const summary = await tenantRentPaymentService.getRentSummary("tenant-1");

    expect(summary.hasActiveLease).toBe(true);
    expect(summary.hasPastLeases).toBe(true);
    expect(summary.leases).toHaveLength(1);
    expect(summary.leases[0]?.leaseId).toBe("lease-1");
    expect(summary.leases[0]?.duePeriodKeys).toEqual(["2026-01"]);
    expect(summary.totalAmountDueCents).toBe(200_00);
  });

  test("uses schedule paidRent for partial Stripe allocation in rent summary", async () => {
    mockListLeases.mockImplementation((_tenantUserId: string, status: string) => {
      if (status === TenantLeaseListStatus.ACTIVE) {
        return Promise.resolve([
          makeLeaseListItem({
            leaseId: "lease-1",
            propertyName: "A",
            unitLabel: "1",
          }),
        ]);
      }
      return Promise.resolve([]);
    });
    mockGetRentSchedule.mockResolvedValueOnce([
      {
        expectedRent: 1500,
        isPaid: false,
        month: "2026-01",
        paidRent: 500,
        remainingRent: 1000,
      },
    ]);

    const summary = await tenantRentPaymentService.getRentSummary("tenant-1");

    expect(summary.totalAmountDueCents).toBe(1000_00);
    expect(summary.leases[0]?.amountDueCents).toBe(1000_00);
    expect(summary.leases[0]?.duePeriodKeys).toEqual(["2026-01"]);
    expect(mockSumSucceededByMonths).not.toHaveBeenCalled();
  });

  test("includes week-start duePeriodKeys for weekly leases", async () => {
    mockListLeases.mockImplementation((_tenantUserId: string, status: string) => {
      if (status === TenantLeaseListStatus.ACTIVE) {
        return Promise.resolve([
          makeLeaseListItem({
            leaseId: "lease-weekly",
            propertyName: "Weekly Property",
            unitLabel: "A",
          }),
        ]);
      }
      return Promise.resolve([]);
    });
    mockGetRentSchedule.mockResolvedValueOnce([
      {
        expectedRent: 700,
        isPaid: false,
        month: "2026-01-15",
        paidRent: 0,
        remainingRent: 700,
      },
      {
        expectedRent: 700,
        isPaid: false,
        month: "2026-01-22",
        paidRent: 0,
        remainingRent: 700,
      },
      {
        expectedRent: 700,
        isPaid: false,
        month: "2026-01-29",
        paidRent: 0,
        remainingRent: 700,
      },
    ]);

    const summary = await tenantRentPaymentService.getRentSummary("tenant-1");

    expect(summary.leases[0]?.duePeriodKeys).toEqual(["2026-01-15", "2026-01-22"]);
    expect(summary.totalAmountDueCents).toBe(1400_00);
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
