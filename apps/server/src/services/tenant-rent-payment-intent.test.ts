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
const mockCreateWithAllocations = mockResolvedNull<ITenantRentPayment>();
const mockFindByIdempotencyKey = mockResolvedNull<ITenantRentPayment>();
const mockFindOpenPaymentIntentPayment = mockResolvedNull<ITenantRentPayment>();
const mockUpdateChargeMethodAndIdempotencyKey = mockResolvedNull<ITenantRentPayment>();
const mockUpdateStripeIds = mockResolvedNull<ITenantRentPayment>();
const mockListAllocations = mockAsyncFn(() =>
  Promise.resolve([
    { allocatedCents: 200_00, expectedCentsSnapshot: 200_00, periodMonth: "2026-01" },
  ])
);
const mockFindTenantUserById = mockAsyncFn(() =>
  Promise.resolve({
    createdAt: "2026-01-01T00:00:00.000Z",
    email: "tenant@example.com",
    emailVerifiedAt: null,
    id: "tenant-1",
    name: "Tenant One",
    phone: null,
    phoneVerifiedAt: null,
    smsConsentedAt: null,
    smsOptedOutAt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
  })
);
const mockGetStripeCustomerId = mockAsyncFn(() => Promise.resolve(null as string | null));
const mockSetStripeCustomerIdIfNull = mockAsyncFn((_tenantUserId: string, customerId: string) =>
  Promise.resolve(customerId)
);
const mockCustomersCreate = mockAsyncFn(() => Promise.resolve({ id: "cus_1" }));
const mockPaymentIntentsCreate = mockAsyncFn(() =>
  Promise.resolve({
    client_secret: "pi_secret_1",
    id: "pi_new",
    status: "requires_payment_method",
  })
);
const mockPaymentIntentsRetrieve = mockAsyncFn(() =>
  Promise.resolve({
    amount: 200_00,
    client_secret: "pi_secret_existing",
    id: "pi_existing",
    status: "requires_payment_method",
  })
);
const mockPaymentIntentsUpdate = mockAsyncFn(() =>
  Promise.resolve({
    amount: 206_10,
    client_secret: "pi_secret_updated",
    id: "pi_existing",
    status: "requires_payment_method",
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
    findOpenPaymentIntentPayment: mockFindOpenPaymentIntentPayment,
    listAllocations: mockListAllocations,
    updateChargeMethodAndIdempotencyKey: mockUpdateChargeMethodAndIdempotencyKey,
    updateStripeIds: mockUpdateStripeIds,
  },
}));

mock.module("@/db/tenant-users", () => ({
  tenantUsersDb: {
    findById: mockFindTenantUserById,
    getStripeCustomerId: mockGetStripeCustomerId,
    setStripeCustomerIdIfNull: mockSetStripeCustomerIdIfNull,
  },
}));

mock.module("@/db/pg-errors", () => ({
  isPostgresUniqueViolation: (error: unknown) =>
    Boolean(error && typeof error === "object" && (error as { code?: string }).code === "23505"),
}));

mock.module("@/stripe/stripe-client", () => ({
  constructStripeWebhookEvent: () => {
    throw new Error("constructStripeWebhookEvent not used in payment intent tests");
  },
  getStripeClient: () => ({
    accounts: {
      retrieve: mockAccountsRetrieve,
    },
    customers: {
      create: mockCustomersCreate,
    },
    paymentIntents: {
      create: mockPaymentIntentsCreate,
      retrieve: mockPaymentIntentsRetrieve,
      update: mockPaymentIntentsUpdate,
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

const achBody = { paymentMethodFamily: RentPaymentMethodFamily.US_BANK_ACCOUNT };
const cardBody = { paymentMethodFamily: RentPaymentMethodFamily.CARD };

function lastPaymentIntentCreateArgs(): unknown[] {
  const calls = mockPaymentIntentsCreate.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1] as unknown[];
}

describe("tenantRentPaymentService.createPaymentIntent", () => {
  const originalStripeConnectEnabled = process.env.STRIPE_CONNECT_ENABLED;

  beforeEach(() => {
    process.env.STRIPE_CONNECT_ENABLED = "true";
    process.env.TENANT_APP_URL = "http://localhost:5174";
    mockAssertLeaseTenantAccess.mockClear();
    mockFindLeaseById.mockClear();
    mockGetRentSchedule.mockClear();
    mockFindStripeAccount.mockClear();
    mockCreateWithAllocations.mockClear();
    mockFindByIdempotencyKey.mockClear();
    mockFindOpenPaymentIntentPayment.mockClear();
    mockUpdateChargeMethodAndIdempotencyKey.mockClear();
    mockUpdateStripeIds.mockClear();
    mockListAllocations.mockClear();
    mockFindTenantUserById.mockClear();
    mockGetStripeCustomerId.mockClear();
    mockSetStripeCustomerIdIfNull.mockClear();
    mockCustomersCreate.mockClear();
    mockPaymentIntentsCreate.mockClear();
    mockPaymentIntentsRetrieve.mockClear();
    mockPaymentIntentsUpdate.mockClear();
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
    mockGetStripeCustomerId.mockResolvedValue(null);
    mockSetStripeCustomerIdIfNull.mockImplementation((_tenantUserId, customerId) =>
      Promise.resolve(customerId)
    );
  });

  afterEach(() => {
    if (originalStripeConnectEnabled === undefined) {
      delete process.env.STRIPE_CONNECT_ENABLED;
    } else {
      process.env.STRIPE_CONNECT_ENABLED = originalStripeConnectEnabled;
    }
  });

  test("creates ACH PaymentIntent with rent-only charge and Stripe Customer", async () => {
    const created = makePayment({
      chargeCents: 200_00,
      feeCents: 0,
      id: "payment-pi-1",
      paymentMethodFamily: RentPaymentMethodFamily.US_BANK_ACCOUNT,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
    });
    mockCreateWithAllocations.mockResolvedValueOnce(created);
    mockUpdateStripeIds.mockResolvedValueOnce({
      ...created,
      stripePaymentIntentId: "pi_new",
    });

    const result = await tenantRentPaymentService.createPaymentIntent(
      "lease-1",
      "tenant-1",
      achBody
    );

    expect(result).toMatchObject({
      chargeCents: 200_00,
      clientSecret: "pi_secret_1",
      feeCents: 0,
      paymentId: "payment-pi-1",
      paymentMethodFamily: RentPaymentMethodFamily.US_BANK_ACCOUNT,
      rentCents: 200_00,
    });
    expect(mockCustomersCreate).toHaveBeenCalledTimes(1);
    expect(mockCreateWithAllocations).toHaveBeenCalledWith(
      expect.objectContaining({
        chargeCents: 200_00,
        feeCents: 0,
        idempotencyKey: "rent_pi:lease-1:tenant-1:2026-01:us_bank_account",
        paymentMethodFamily: RentPaymentMethodFamily.US_BANK_ACCOUNT,
      })
    );

    const [piParams] = lastPaymentIntentCreateArgs() as [
      {
        amount: number;
        application_fee_amount?: number;
        automatic_payment_methods: { enabled: boolean };
        customer: string;
        excluded_payment_method_types: string[];
        payment_method_types: string[];
        transfer_data: { destination: string };
      },
    ];
    expect(piParams.amount).toBe(200_00);
    expect(piParams.application_fee_amount).toBeUndefined();
    expect(piParams.automatic_payment_methods).toEqual({ enabled: false });
    expect(piParams.customer).toBe("cus_1");
    expect(piParams.excluded_payment_method_types).toContain("klarna");
    expect(piParams.payment_method_types).toEqual(["us_bank_account"]);
    expect(piParams.transfer_data.destination).toBe("acct_1");
  });

  test("creates card PaymentIntent with convenience fee and application_fee_amount", async () => {
    mockCreateWithAllocations.mockResolvedValueOnce(
      makePayment({
        amountCents: 200_00,
        chargeCents: 206_10,
        feeCents: 610,
        id: "payment-card-pi",
        paymentMethodFamily: RentPaymentMethodFamily.CARD,
        stripeCheckoutSessionId: null,
        stripePaymentIntentId: null,
      })
    );
    mockUpdateStripeIds.mockResolvedValueOnce(
      makePayment({
        amountCents: 200_00,
        chargeCents: 206_10,
        feeCents: 610,
        paymentMethodFamily: RentPaymentMethodFamily.CARD,
        stripePaymentIntentId: "pi_new",
      })
    );

    const result = await tenantRentPaymentService.createPaymentIntent(
      "lease-1",
      "tenant-1",
      cardBody
    );

    expect(result.chargeCents).toBe(206_10);
    expect(result.feeCents).toBe(610);
    const [piParams] = lastPaymentIntentCreateArgs() as [
      {
        amount: number;
        application_fee_amount?: number;
        automatic_payment_methods: { enabled: boolean };
        excluded_payment_method_types: string[];
        payment_method_types: string[];
      },
    ];
    expect(piParams.amount).toBe(206_10);
    expect(piParams.application_fee_amount).toBe(610);
    expect(piParams.automatic_payment_methods).toEqual({ enabled: false });
    expect(piParams.excluded_payment_method_types).toContain("klarna");
    expect(piParams.payment_method_types).toEqual(["card"]);
  });

  test("reuses existing Stripe Customer id without creating a new customer", async () => {
    mockGetStripeCustomerId.mockResolvedValueOnce("cus_existing");
    mockCreateWithAllocations.mockResolvedValueOnce(
      makePayment({
        id: "payment-pi-2",
        stripeCheckoutSessionId: null,
        stripePaymentIntentId: null,
      })
    );
    mockUpdateStripeIds.mockResolvedValueOnce(
      makePayment({ id: "payment-pi-2", stripePaymentIntentId: "pi_new" })
    );

    await tenantRentPaymentService.createPaymentIntent("lease-1", "tenant-1", achBody);

    expect(mockCustomersCreate).not.toHaveBeenCalled();
    const [piParams] = lastPaymentIntentCreateArgs() as [{ customer: string }];
    expect(piParams.customer).toBe("cus_existing");
  });

  test("updates open PaymentIntent when payment method changes before confirm", async () => {
    const openAchPayment = makePayment({
      chargeCents: 200_00,
      feeCents: 0,
      id: "payment-open",
      idempotencyKey: "rent_pi:lease-1:tenant-1:2026-01:us_bank_account",
      paymentMethodFamily: RentPaymentMethodFamily.US_BANK_ACCOUNT,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: "pi_existing",
    });
    mockFindByIdempotencyKey.mockResolvedValueOnce(null);
    mockFindOpenPaymentIntentPayment.mockResolvedValueOnce(openAchPayment);
    mockPaymentIntentsRetrieve.mockResolvedValueOnce({
      amount: 200_00,
      client_secret: "pi_secret_existing",
      id: "pi_existing",
      status: "requires_payment_method",
    });
    mockUpdateChargeMethodAndIdempotencyKey.mockResolvedValueOnce({
      ...openAchPayment,
      chargeCents: 206_10,
      feeCents: 610,
      idempotencyKey: "rent_pi:lease-1:tenant-1:2026-01:card",
      paymentMethodFamily: RentPaymentMethodFamily.CARD,
    });

    const result = await tenantRentPaymentService.createPaymentIntent(
      "lease-1",
      "tenant-1",
      cardBody
    );

    expect(mockPaymentIntentsUpdate).toHaveBeenCalledTimes(1);
    expect(mockCreateWithAllocations).not.toHaveBeenCalled();
    expect(mockUpdateChargeMethodAndIdempotencyKey).toHaveBeenCalledWith("payment-open", {
      chargeCents: 206_10,
      feeCents: 610,
      idempotencyKey: "rent_pi:lease-1:tenant-1:2026-01:card",
      paymentMethodFamily: RentPaymentMethodFamily.CARD,
    });
    expect(result).toMatchObject({
      chargeCents: 206_10,
      clientSecret: "pi_secret_updated",
      feeCents: 610,
      paymentMethodFamily: RentPaymentMethodFamily.CARD,
      rentCents: 200_00,
    });
  });
});
