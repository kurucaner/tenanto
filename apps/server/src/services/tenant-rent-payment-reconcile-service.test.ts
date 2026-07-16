import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { ITenantRentPayment } from "@/db/tenant-rent-payments";
import { TenantRentPaymentStatus } from "@/packages/shared";

const mockListReconcileCandidatesSince = mock(() => Promise.resolve([] as ITenantRentPayment[]));
const mockFindById = mock(() => Promise.resolve(null as ITenantRentPayment | null));
const mockMarkSucceeded = mock(() => Promise.resolve(null as unknown));
const mockMarkCanceled = mock(() => Promise.resolve(null as unknown));
const mockRetrievePi = mock(() => Promise.resolve({ id: "pi_1", status: "succeeded" }));
const mockListPi = mock(() => Promise.resolve({ data: [] as unknown[] }));
const mockIsStripeConfigured = mock(() => true);
const mockWinstonInfo = mock(() => undefined);
const mockWinstonWarn = mock(() => undefined);

mock.module("@/db/tenant-rent-payments", () => ({
  tenantRentPaymentsDb: {
    findById: mockFindById,
    listReconcileCandidatesSince: mockListReconcileCandidatesSince,
  },
}));

mock.module("@/services/tenant-rent-payment-service", () => ({
  tenantRentPaymentService: {
    markCanceled: mockMarkCanceled,
    markSucceeded: mockMarkSucceeded,
  },
}));

mock.module("@/stripe/stripe-client", () => ({
  constructStripeWebhookEvent: () => {
    throw new Error("unused");
  },
  getStripeClient: () => ({
    paymentIntents: {
      list: mockListPi,
      retrieve: mockRetrievePi,
    },
  }),
  isStripeSecretConfigured: mockIsStripeConfigured,
}));

mock.module("@/services/winston", () => ({
  WinstonLogger: {
    error: mock(() => undefined),
    info: mockWinstonInfo,
    warn: mockWinstonWarn,
  },
}));

const { reconcileTenantRentPayments } = await import("./tenant-rent-payment-reconcile-service");

function makePayment(overrides: Partial<ITenantRentPayment> = {}): ITenantRentPayment {
  return {
    amountCents: 100_00,
    connectedAccountId: "acct_1",
    createdAt: "2026-01-01T00:00:00.000Z",
    currency: "usd",
    id: "payment-1",
    idempotencyKey: "key-1",
    leaseId: "lease-1",
    propertyId: "property-1",
    status: TenantRentPaymentStatus.PENDING,
    stripeCheckoutSessionId: "cs_1",
    stripePaymentIntentId: "pi_1",
    tenantUserId: "tenant-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("reconcileTenantRentPayments", () => {
  beforeEach(() => {
    mockListReconcileCandidatesSince.mockReset();
    mockFindById.mockReset();
    mockMarkSucceeded.mockReset();
    mockMarkCanceled.mockReset();
    mockRetrievePi.mockReset();
    mockListPi.mockReset();
    mockIsStripeConfigured.mockReset();
    mockWinstonInfo.mockReset();
    mockWinstonWarn.mockReset();
    mockIsStripeConfigured.mockReturnValue(true);
    mockListPi.mockResolvedValue({ data: [] });
  });

  test("skips when Stripe is not configured", async () => {
    mockIsStripeConfigured.mockReturnValue(false);
    const result = await reconcileTenantRentPayments();
    expect(result).toEqual({ gaps: 0, recovered: 0, scannedLocal: 0, scannedStripe: 0 });
    expect(mockWinstonInfo).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "tenant_payments.reconcile_skipped" })
    );
  });

  test("recovers local open payment when Stripe PaymentIntent succeeded", async () => {
    const payment = makePayment();
    mockListReconcileCandidatesSince.mockResolvedValueOnce([payment]);
    mockRetrievePi.mockResolvedValueOnce({ id: "pi_1", status: "succeeded" });
    mockFindById.mockResolvedValue(payment);
    mockMarkSucceeded.mockResolvedValueOnce({
      ...payment,
      status: TenantRentPaymentStatus.SUCCEEDED,
    });

    const result = await reconcileTenantRentPayments();

    expect(mockMarkSucceeded).toHaveBeenCalledWith(payment, "pi_1");
    expect(result.recovered).toBe(1);
    expect(result.gaps).toBe(0);
    expect(mockWinstonInfo).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "tenant_payments.reconcile_recovered" })
    );
  });

  test("logs reconcile_gap when Stripe succeeded but local row missing", async () => {
    mockListReconcileCandidatesSince.mockResolvedValueOnce([]);
    mockListPi.mockResolvedValueOnce({
      data: [
        {
          id: "pi_orphan",
          metadata: { paymentId: "missing-payment" },
          status: "succeeded",
        },
      ],
    });
    mockFindById.mockResolvedValueOnce(null);

    const result = await reconcileTenantRentPayments();

    expect(result.gaps).toBe(1);
    expect(result.recovered).toBe(0);
    expect(mockWinstonWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "tenant_payments.reconcile_gap",
        reason: "stripe_succeeded_without_local_row",
      })
    );
  });

  test("recovers from Stripe list when local row still pending", async () => {
    const payment = makePayment({ id: "payment-2", stripePaymentIntentId: "pi_2" });
    mockListReconcileCandidatesSince.mockResolvedValueOnce([]);
    mockListPi.mockResolvedValueOnce({
      data: [
        {
          id: "pi_2",
          metadata: { paymentId: "payment-2" },
          status: "succeeded",
        },
      ],
    });
    mockFindById.mockResolvedValue(payment);
    mockMarkSucceeded.mockResolvedValueOnce({
      ...payment,
      status: TenantRentPaymentStatus.SUCCEEDED,
    });

    const result = await reconcileTenantRentPayments();

    expect(mockMarkSucceeded).toHaveBeenCalledWith(payment, "pi_2");
    expect(result.recovered).toBe(1);
  });
});
