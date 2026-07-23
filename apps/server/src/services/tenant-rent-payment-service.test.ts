import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { IPropertyStripeAccount } from "@/db/property-stripe-accounts";
import type { ITenantRentPayment } from "@/db/tenant-rent-payments";
import { PropertyStripeAccountType, RentPaymentMethodFamily } from "@/packages/shared";
import { makePayment, makeRentScheduleRow } from "@/test-fixtures/domain";
import { mockAsyncFn, mockResolved, mockResolvedNull, mockSyncVoid } from "@/test-fixtures/mocks";

const connectedStripeAccount: IPropertyStripeAccount = {
  accountType: PropertyStripeAccountType.EXPRESS,
  chargesEnabled: true,
  detailsSubmitted: true,
  onboardingComplete: true,
  payoutsEnabled: true,
  propertyId: "property-1",
  stripeAccountId: "acct_1",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const mockAssertLeaseTenantAccess = mockResolved({});
const mockFindLeaseById = mockAsyncFn(() =>
  Promise.resolve({
    id: "lease-1",
    propertyId: "property-1",
    unitId: "unit-1",
  } as { id: string; propertyId: string; unitId: string } | null)
);
const mockGetRentSchedule = mockAsyncFn(() =>
  Promise.resolve([makeRentScheduleRow({ expectedRent: 200, isPaid: false, month: "2026-01" })])
);
const mockFindStripeAccount = mockAsyncFn(() => Promise.resolve(connectedStripeAccount));
const mockSumSucceededByMonths = mockResolved(new Map<string, number>());
const mockCreateWithAllocations = mockResolvedNull<ITenantRentPayment>();
const mockFindByIdempotencyKey = mockResolvedNull<ITenantRentPayment>();
const mockUpdateStripeIds = mockResolvedNull<ITenantRentPayment>();
const mockSessionsCreate = mockAsyncFn(() =>
  Promise.resolve({
    id: "cs_new",
    payment_intent: "pi_new",
    url: "https://checkout.stripe.test/pay/cs_new",
  })
);
const mockSessionsRetrieve = mockAsyncFn(() =>
  Promise.resolve({
    id: "cs_existing",
    status: "open",
    url: "https://checkout.stripe.test/pay/cs_existing",
  })
);
const mockAccountsRetrieve = mockAsyncFn(() =>
  Promise.resolve({
    capabilities: { us_bank_account_ach_payments: "active" },
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
    accounts: {
      retrieve: mockAccountsRetrieve,
    },
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
    error: mockSyncVoid(),
    info: mockSyncVoid(),
    warn: mockSyncVoid(),
  },
}));

mock.module("@/lib/date-utils", () => ({
  getTodayUtcIsoDate: () => "2026-01-22",
}));

const { tenantRentPaymentService } = await import("./tenant-rent-payment-service");

const achCheckoutBody = { paymentMethodFamily: RentPaymentMethodFamily.US_BANK_ACCOUNT };
const cardCheckoutBody = { paymentMethodFamily: RentPaymentMethodFamily.CARD };

function lastCheckoutSessionCreateArgs(): unknown[] {
  const calls = mockSessionsCreate.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1] as unknown[];
}

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
    mockAccountsRetrieve.mockClear();

    mockFindLeaseById.mockResolvedValue({
      id: "lease-1",
      propertyId: "property-1",
      unitId: "unit-1",
    });
    mockGetRentSchedule.mockResolvedValue([
      makeRentScheduleRow({ expectedRent: 200, isPaid: false, month: "2026-01" }),
    ]);
    mockFindStripeAccount.mockResolvedValue(connectedStripeAccount);
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

    const result = await tenantRentPaymentService.createCheckout(
      "lease-1",
      "tenant-1",
      achCheckoutBody
    );

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

    const result = await tenantRentPaymentService.createCheckout(
      "lease-1",
      "tenant-1",
      achCheckoutBody
    );

    expect(result.paymentId).toBe("payment-2");
    expect(result.checkoutUrl).toContain("cs_new");
    expect(mockSessionsCreate).toHaveBeenCalledTimes(1);
  });

  test("rejects checkout when nothing is due", async () => {
    mockGetRentSchedule.mockResolvedValueOnce([
      makeRentScheduleRow({ expectedRent: 200, isPaid: true, month: "2026-01" }),
    ]);

    await expect(
      tenantRentPaymentService.createCheckout("lease-1", "tenant-1", achCheckoutBody)
    ).rejects.toThrow("Nothing is due right now");
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
    mockAccountsRetrieve.mockClear();
    mockFindByIdempotencyKey.mockClear();
    mockFindStripeAccount.mockResolvedValue(connectedStripeAccount);
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

    await tenantRentPaymentService.createCheckout("lease-1", "tenant-1", achCheckoutBody);

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

  test("createCheckout allocates due weeks with week-start period keys", async () => {
    mockGetRentSchedule.mockResolvedValueOnce([
      makeRentScheduleRow({
        expectedRent: 700,
        isPaid: false,
        month: "2026-01-15",
        paidRent: 0,
        remainingRent: 700,
      }),
      makeRentScheduleRow({
        expectedRent: 700,
        isPaid: false,
        month: "2026-01-22",
        paidRent: 0,
        remainingRent: 700,
      }),
      makeRentScheduleRow({
        expectedRent: 700,
        isPaid: false,
        month: "2026-01-29",
        paidRent: 0,
        remainingRent: 700,
      }),
    ]);
    mockCreateWithAllocations.mockResolvedValueOnce(makePayment({ amountCents: 1400_00 }));
    mockUpdateStripeIds.mockResolvedValueOnce(makePayment({ amountCents: 1400_00 }));

    await tenantRentPaymentService.createCheckout("lease-1", "tenant-1", achCheckoutBody);

    expect(mockCreateWithAllocations).toHaveBeenCalledWith(
      expect.objectContaining({
        allocations: [
          expect.objectContaining({
            allocatedCents: 700_00,
            periodMonth: "2026-01-15",
          }),
          expect.objectContaining({
            allocatedCents: 700_00,
            periodMonth: "2026-01-22",
          }),
        ],
        amountCents: 1400_00,
        chargeCents: 1400_00,
        feeCents: 0,
        idempotencyKey:
          "rent_checkout:lease-1:tenant-1:2026-01-15,2026-01-22:us_bank_account:140000",
        paymentMethodFamily: RentPaymentMethodFamily.US_BANK_ACCOUNT,
      })
    );
  });

  test("creates ACH Checkout locked to us_bank_account with rent-only charge", async () => {
    mockCreateWithAllocations.mockResolvedValueOnce(makePayment({ amountCents: 200_00 }));
    mockUpdateStripeIds.mockResolvedValueOnce(makePayment({ amountCents: 200_00 }));

    await tenantRentPaymentService.createCheckout("lease-1", "tenant-1", achCheckoutBody);

    expect(mockCreateWithAllocations).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 200_00,
        chargeCents: 200_00,
        feeCents: 0,
        paymentMethodFamily: RentPaymentMethodFamily.US_BANK_ACCOUNT,
      })
    );

    const [sessionParams] = lastCheckoutSessionCreateArgs() as [
      {
        line_items: Array<{ price_data: { unit_amount: number } }>;
        metadata: Record<string, string>;
        payment_intent_data: Record<string, unknown>;
        payment_method_types: string[];
      },
    ];
    expect(sessionParams.payment_method_types).toEqual(["us_bank_account"]);
    expect(sessionParams.line_items[0]?.price_data.unit_amount).toBe(200_00);
    expect(sessionParams.metadata).toMatchObject({
      amountCents: "20000",
      chargeCents: "20000",
      feeCents: "0",
      paymentMethodFamily: RentPaymentMethodFamily.US_BANK_ACCOUNT,
    });
    expect(sessionParams.payment_intent_data).not.toHaveProperty("application_fee_amount");
  });

  test("creates card Checkout with convenience fee and application_fee_amount", async () => {
    mockCreateWithAllocations.mockResolvedValueOnce(
      makePayment({
        amountCents: 200_00,
        chargeCents: 206_10,
        feeCents: 610,
        paymentMethodFamily: RentPaymentMethodFamily.CARD,
      })
    );
    mockUpdateStripeIds.mockResolvedValueOnce(
      makePayment({
        amountCents: 200_00,
        chargeCents: 206_10,
        feeCents: 610,
        paymentMethodFamily: RentPaymentMethodFamily.CARD,
      })
    );

    await tenantRentPaymentService.createCheckout("lease-1", "tenant-1", cardCheckoutBody);

    expect(mockCreateWithAllocations).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 200_00,
        chargeCents: 206_10,
        feeCents: 610,
        paymentMethodFamily: RentPaymentMethodFamily.CARD,
      })
    );

    const [sessionParams] = lastCheckoutSessionCreateArgs() as [
      {
        line_items: Array<{ price_data: { unit_amount: number } }>;
        metadata: Record<string, string>;
        payment_intent_data: { application_fee_amount?: number; metadata: Record<string, string> };
        payment_method_types: string[];
      },
    ];
    expect(sessionParams.payment_method_types).toEqual(["card"]);
    expect(sessionParams.line_items[0]?.price_data.unit_amount).toBe(206_10);
    expect(sessionParams.metadata).toMatchObject({
      amountCents: "20000",
      chargeCents: "20610",
      feeCents: "610",
      paymentMethodFamily: RentPaymentMethodFamily.CARD,
    });
    expect(sessionParams.payment_intent_data.application_fee_amount).toBe(610);
    expect(sessionParams.payment_intent_data.metadata.paymentMethodFamily).toBe(
      RentPaymentMethodFamily.CARD
    );
  });

  test("does not reuse open Checkout when payment method differs", async () => {
    mockCreateWithAllocations.mockResolvedValueOnce(
      makePayment({
        id: "payment-card",
        paymentMethodFamily: RentPaymentMethodFamily.CARD,
        stripeCheckoutSessionId: null,
        stripePaymentIntentId: null,
      })
    );
    mockUpdateStripeIds.mockResolvedValueOnce(
      makePayment({
        id: "payment-card",
        paymentMethodFamily: RentPaymentMethodFamily.CARD,
      })
    );

    await tenantRentPaymentService.createCheckout("lease-1", "tenant-1", cardCheckoutBody);

    expect(mockFindByIdempotencyKey).not.toHaveBeenCalled();
    expect(mockSessionsCreate).toHaveBeenCalledTimes(1);
  });
});
