import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { IPropertyStripeAccount } from "@/db/property-stripe-accounts";
import type { ITenantRentPayment } from "@/db/tenant-rent-payments";
import { makePayment, makeRentScheduleRow } from "@/test-fixtures/domain";

const mockAssertLeaseTenantAccess = mock(() => Promise.resolve({}));
const mockFindLeaseById = mock(() =>
  Promise.resolve({
    id: "lease-1",
    propertyId: "property-1",
    unitId: "unit-1",
  } as { id: string; propertyId: string; unitId: string } | null)
);
const mockGetRentSchedule = mock(() =>
  Promise.resolve([makeRentScheduleRow({ expectedRent: 200, isPaid: false, month: "2026-01" })])
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
const mockCreateWithAllocations = mock(() => Promise.resolve(null as ITenantRentPayment | null));
const mockFindByIdempotencyKey = mock(() => Promise.resolve(null as ITenantRentPayment | null));
const mockUpdateStripeIds = mock(() => Promise.resolve(null as ITenantRentPayment | null));
const mockSessionsCreate = mock(() =>
  Promise.resolve({
    id: "cs_new",
    payment_intent: "pi_new",
    url: "https://checkout.stripe.test/pay/cs_new",
  })
);
const mockSessionsRetrieve = mock(() =>
  Promise.resolve({
    id: "cs_existing",
    status: "open",
    url: "https://checkout.stripe.test/pay/cs_existing",
  })
);

mock.module("@/services/tenant-portal-access", () => ({
  assertLeaseTenantAccess: mockAssertLeaseTenantAccess,
  assertLeaseTenantReadAccess: mockAssertLeaseTenantAccess,
  TenantLeaseAccessDeniedError: class extends Error {
    name = "TenantLeaseAccessDeniedError";
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
    platformEnabled: true,
    stripeAccountId: null,
  }),
}));

mock.module("@/db/tenant-rent-payments", () => ({
  tenantRentPaymentsDb: {
    createWithAllocations: mockCreateWithAllocations,
    findByIdempotencyKey: mockFindByIdempotencyKey,
    sumSucceededAllocatedCentsByMonths: mockSumSucceededByMonths,
    updateStripeIds: mockUpdateStripeIds,
  },
}));

mock.module("@/db/pg-errors", () => ({
  isPostgresUniqueViolation: (error: unknown) =>
    Boolean(error && typeof error === "object" && (error as { code?: string }).code === "23505"),
}));

mock.module("@/stripe/stripe-client", () => ({
  constructStripeWebhookEvent: () => {
    throw new Error("constructStripeWebhookEvent not used in checkout tests");
  },
  getStripeClient: () => ({
    checkout: {
      sessions: {
        create: mockSessionsCreate,
        retrieve: mockSessionsRetrieve,
      },
    },
  }),
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

describe("tenantRentPaymentService.createCheckout idempotency", () => {
  const originalStripeConnectEnabled = process.env.STRIPE_CONNECT_ENABLED;

  beforeEach(() => {
    process.env.STRIPE_CONNECT_ENABLED = "true";
    process.env.TENANT_APP_URL = "http://localhost:5174";
    mockAssertLeaseTenantAccess.mockClear();
    mockFindLeaseById.mockClear();
    mockGetRentSchedule.mockClear();
    mockFindStripeAccount.mockClear();
    mockSumSucceededByMonths.mockClear();
    mockCreateWithAllocations.mockClear();
    mockFindByIdempotencyKey.mockClear();
    mockUpdateStripeIds.mockClear();
    mockSessionsCreate.mockClear();
    mockSessionsRetrieve.mockClear();

    mockFindLeaseById.mockResolvedValue({
      id: "lease-1",
      propertyId: "property-1",
      unitId: "unit-1",
    });
    mockGetRentSchedule.mockResolvedValue([
      makeRentScheduleRow({ expectedRent: 200, isPaid: false, month: "2026-01" }),
    ]);
    mockFindStripeAccount.mockResolvedValue({
      chargesEnabled: true,
      detailsSubmitted: true,
      onboardingComplete: true,
      payoutsEnabled: true,
      propertyId: "property-1",
      stripeAccountId: "acct_1",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    mockSumSucceededByMonths.mockResolvedValue(new Map());
  });

  afterEach(() => {
    if (originalStripeConnectEnabled === undefined) {
      delete process.env.STRIPE_CONNECT_ENABLED;
    } else {
      process.env.STRIPE_CONNECT_ENABLED = originalStripeConnectEnabled;
    }
  });

  test("returns existing open Checkout Session on duplicate click", async () => {
    const existing = makePayment();
    mockCreateWithAllocations.mockRejectedValueOnce({ code: "23505" });
    mockFindByIdempotencyKey.mockResolvedValueOnce(existing);

    const result = await tenantRentPaymentService.createCheckout("lease-1", "tenant-1");

    expect(result).toEqual({
      checkoutUrl: "https://checkout.stripe.test/pay/cs_existing",
      paymentId: "payment-1",
    });
    expect(mockSessionsCreate).not.toHaveBeenCalled();
    expect(mockSessionsRetrieve).toHaveBeenCalledWith("cs_existing");
  });

  test("creates a new session when no prior payment exists", async () => {
    const created = makePayment({
      id: "payment-2",
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
    });
    mockCreateWithAllocations.mockResolvedValueOnce(created);
    mockUpdateStripeIds.mockResolvedValueOnce({
      ...created,
      stripeCheckoutSessionId: "cs_new",
      stripePaymentIntentId: "pi_new",
    });

    const result = await tenantRentPaymentService.createCheckout("lease-1", "tenant-1");

    expect(result.paymentId).toBe("payment-2");
    expect(result.checkoutUrl).toContain("cs_new");
    expect(mockSessionsCreate).toHaveBeenCalledTimes(1);
  });

  test("rejects checkout when nothing is due", async () => {
    mockGetRentSchedule.mockResolvedValueOnce([
      makeRentScheduleRow({ expectedRent: 200, isPaid: true, month: "2026-01" }),
    ]);

    await expect(tenantRentPaymentService.createCheckout("lease-1", "tenant-1")).rejects.toThrow(
      "Nothing is due right now"
    );
    expect(mockSessionsCreate).not.toHaveBeenCalled();
  });

  test("uses schedule paidRent for partial balance without double-counting allocations", async () => {
    mockGetRentSchedule.mockResolvedValueOnce([
      makeRentScheduleRow({
        expectedRent: 200,
        isPaid: false,
        month: "2026-01",
        paidRent: 50,
        remainingRent: 150,
      }),
    ]);

    const balance = await tenantRentPaymentService.getBalance("lease-1", "tenant-1");

    expect(balance.amountDueCents).toBe(150_00);
    expect(balance.periods[0]).toMatchObject({
      month: "2026-01",
      paidCents: 50_00,
      remainingCents: 150_00,
    });
    expect(mockSumSucceededByMonths).not.toHaveBeenCalled();
  });
});

describe("tenantRentPaymentService tenant balance rollup", () => {
  const originalStripeConnectEnabled = process.env.STRIPE_CONNECT_ENABLED;

  beforeEach(() => {
    process.env.STRIPE_CONNECT_ENABLED = "true";
    process.env.TENANT_APP_URL = "http://localhost:5174";
    mockAssertLeaseTenantAccess.mockClear();
    mockGetRentSchedule.mockClear();
    mockFindStripeAccount.mockClear();
    mockSumSucceededByMonths.mockClear();
    mockCreateWithAllocations.mockClear();
    mockUpdateStripeIds.mockClear();
    mockSessionsCreate.mockClear();
    mockFindStripeAccount.mockResolvedValue({
      chargesEnabled: true,
      detailsSubmitted: true,
      onboardingComplete: true,
      payoutsEnabled: true,
      propertyId: "property-1",
      stripeAccountId: "acct_1",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  afterEach(() => {
    if (originalStripeConnectEnabled === undefined) {
      delete process.env.STRIPE_CONNECT_ENABLED;
    } else {
      process.env.STRIPE_CONNECT_ENABLED = originalStripeConnectEnabled;
    }
  });

  test("createCheckout charges only remaining cents after partial payment", async () => {
    mockGetRentSchedule.mockResolvedValueOnce([
      makeRentScheduleRow({
        expectedRent: 1500,
        isPaid: false,
        month: "2026-01",
        paidRent: 500,
        remainingRent: 1000,
      }),
    ]);
    mockCreateWithAllocations.mockResolvedValueOnce(makePayment({ amountCents: 1000_00 }));
    mockUpdateStripeIds.mockResolvedValueOnce(makePayment({ amountCents: 1000_00 }));

    await tenantRentPaymentService.createCheckout("lease-1", "tenant-1");

    expect(mockCreateWithAllocations).toHaveBeenCalledWith(
      expect.objectContaining({
        allocations: [
          expect.objectContaining({
            allocatedCents: 1000_00,
            periodMonth: "2026-01",
          }),
        ],
        amountCents: 1000_00,
      })
    );
    expect(mockSumSucceededByMonths).not.toHaveBeenCalled();
  });

  test("getBalance returns zero due when schedule month is fully paid", async () => {
    mockGetRentSchedule.mockResolvedValueOnce([
      makeRentScheduleRow({ expectedRent: 1500, isPaid: true, month: "2026-01", paidRent: 1500 }),
    ]);

    const balance = await tenantRentPaymentService.getBalance("lease-1", "tenant-1");

    expect(balance.amountDueCents).toBe(0);
    expect(balance.periods[0]).toMatchObject({
      month: "2026-01",
      paidCents: 1500_00,
      remainingCents: 0,
    });
  });

  test("getBalance returns paymentsEnabled false when STRIPE_CONNECT_ENABLED is off", async () => {
    process.env.STRIPE_CONNECT_ENABLED = "false";

    const balance = await tenantRentPaymentService.getBalance("lease-1", "tenant-1");

    expect(balance.paymentsEnabled).toBe(false);
  });
});
