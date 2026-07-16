import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { IPropertyStripeAccount } from "@/db/property-stripe-accounts";
import type { ITenantRentPayment } from "@/db/tenant-rent-payments";
import { buildRentCheckoutIdempotencyKey, TenantRentPaymentStatus } from "@/packages/shared";

const mockAssertLeaseTenantAccess = mock(() => Promise.resolve({}));
const mockFindLeaseById = mock(() =>
  Promise.resolve({
    id: "lease-1",
    propertyId: "property-1",
    unitId: "unit-1",
  } as { id: string; propertyId: string; unitId: string } | null)
);
function scheduleRow(overrides: {
  expectedRent: number;
  isPaid: boolean;
  month: string;
  paidRent?: number;
  remainingRent?: number;
}) {
  const paidRent = overrides.paidRent ?? (overrides.isPaid ? overrides.expectedRent : 0);
  const remainingRent =
    overrides.remainingRent ?? (overrides.isPaid ? 0 : overrides.expectedRent - paidRent);

  return {
    expectedRent: overrides.expectedRent,
    isPaid: overrides.isPaid,
    month: overrides.month,
    paidRent,
    remainingRent,
  };
}

const mockGetRentSchedule = mock(() =>
  Promise.resolve([scheduleRow({ expectedRent: 200, isPaid: false, month: "2026-01" })])
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
    stripeAccountId: null,
  }),
}));

mock.module("@/services/property-stripe-connect-service", () => ({
  StripeConnectNotConfiguredError: class extends Error {
    name = "StripeConnectNotConfiguredError";
  },
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
    status: TenantRentPaymentStatus.PENDING,
    stripeCheckoutSessionId: "cs_existing",
    stripePaymentIntentId: "pi_existing",
    tenantUserId: "tenant-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("tenantRentPaymentService.createCheckout idempotency", () => {
  beforeEach(() => {
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
      scheduleRow({ expectedRent: 200, isPaid: false, month: "2026-01" }),
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
      scheduleRow({ expectedRent: 200, isPaid: true, month: "2026-01" }),
    ]);

    await expect(tenantRentPaymentService.createCheckout("lease-1", "tenant-1")).rejects.toThrow(
      "Nothing is due right now"
    );
    expect(mockSessionsCreate).not.toHaveBeenCalled();
  });

  test("uses schedule paidRent for partial balance without double-counting allocations", async () => {
    mockGetRentSchedule.mockResolvedValueOnce([
      scheduleRow({
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
