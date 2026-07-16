import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { ITenantRentPayment } from "@/db/tenant-rent-payments";
import { TenantRentPaymentStatus } from "@/packages/shared";

const mockFindById = mock(() => Promise.resolve(null as unknown));
const mockTryInsert = mock(() => Promise.resolve(null as unknown));
const mockMarkProcessed = mock(() => Promise.resolve());
const mockFindPaymentById = mock(() => Promise.resolve(null as ITenantRentPayment | null));
const mockFindByCheckoutSessionId = mock(() => Promise.resolve(null as ITenantRentPayment | null));
const mockFindByPaymentIntentId = mock(() => Promise.resolve(null as ITenantRentPayment | null));
const mockUpdateStripeIds = mock(() => Promise.resolve(null as ITenantRentPayment | null));
const mockMarkSucceeded = mock(() => Promise.resolve(null as unknown));
const mockMarkFailed = mock(() => Promise.resolve(null as unknown));
const mockMarkCanceled = mock(() => Promise.resolve(null as unknown));

mock.module("@/db/stripe-webhook-events", () => ({
  stripeWebhookEventsDb: {
    findById: mockFindById,
    markProcessed: mockMarkProcessed,
    tryInsert: mockTryInsert,
  },
}));

mock.module("@/db/tenant-rent-payments", () => ({
  tenantRentPaymentsDb: {
    findByCheckoutSessionId: mockFindByCheckoutSessionId,
    findById: mockFindPaymentById,
    findByPaymentIntentId: mockFindByPaymentIntentId,
    updateStripeIds: mockUpdateStripeIds,
  },
}));

mock.module("@/services/tenant-rent-payment-service", () => ({
  tenantRentPaymentService: {
    markCanceled: mockMarkCanceled,
    markFailed: mockMarkFailed,
    markSucceeded: mockMarkSucceeded,
  },
}));

mock.module("@/services/winston", () => ({
  WinstonLogger: {
    error: mock(() => undefined),
    info: mock(() => undefined),
    warn: mock(() => undefined),
  },
}));

mock.module("@/stripe/stripe-client", () => ({
  constructStripeWebhookEvent: mock(() => {
    throw new Error("not used in these tests");
  }),
  getStripeClient: mock(() => ({})),
  isStripeSecretConfigured: () => true,
  verifyStripeWebhookPayload: mock(() => {
    throw new Error("not used in these tests");
  }),
}));

const { processStripeEventNotification, processStripeWebhookEvent } = await import(
  "./stripe-webhook-service"
);

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
    stripeCheckoutSessionId: "cs_test_1",
    stripePaymentIntentId: null,
    tenantUserId: "tenant-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("processStripeWebhookEvent", () => {
  beforeEach(() => {
    mockFindById.mockReset();
    mockTryInsert.mockReset();
    mockMarkProcessed.mockReset();
    mockFindPaymentById.mockReset();
    mockFindByCheckoutSessionId.mockReset();
    mockFindByPaymentIntentId.mockReset();
    mockUpdateStripeIds.mockReset();
    mockMarkSucceeded.mockReset();
    mockMarkFailed.mockReset();
    mockMarkCanceled.mockReset();
  });

  test("skips already-processed events (double webhook)", async () => {
    mockFindById.mockResolvedValueOnce({
      createdAt: "2026-01-01T00:00:00.000Z",
      payload: {},
      processedAt: "2026-01-01T00:01:00.000Z",
      stripeEventId: "evt_1",
      type: "checkout.session.completed",
    });

    await processStripeWebhookEvent({
      created: 1,
      data: { object: { id: "cs_test_1", object: "checkout.session" } },
      id: "evt_1",
      livemode: false,
      object: "event",
      type: "checkout.session.completed",
    } as never);

    expect(mockTryInsert).not.toHaveBeenCalled();
    expect(mockMarkSucceeded).not.toHaveBeenCalled();
    expect(mockMarkProcessed).not.toHaveBeenCalled();
  });

  test("applies checkout.session.completed once", async () => {
    mockFindById.mockResolvedValueOnce(null);
    mockTryInsert.mockResolvedValueOnce({
      createdAt: "2026-01-01T00:00:00.000Z",
      payload: {},
      processedAt: null,
      stripeEventId: "evt_2",
      type: "checkout.session.completed",
    });
    const payment = makePayment();
    mockFindPaymentById.mockResolvedValueOnce(payment);
    mockUpdateStripeIds.mockResolvedValueOnce(payment);
    mockMarkSucceeded.mockResolvedValueOnce(payment);

    await processStripeWebhookEvent({
      created: 1,
      data: {
        object: {
          id: "cs_test_1",
          metadata: { paymentId: "payment-1" },
          object: "checkout.session",
          payment_intent: "pi_1",
          payment_status: "paid",
        },
      },
      id: "evt_2",
      livemode: false,
      object: "event",
      type: "checkout.session.completed",
    } as never);

    expect(mockMarkSucceeded).toHaveBeenCalledTimes(1);
    expect(mockMarkProcessed).toHaveBeenCalledWith("evt_2");
  });

  test("marks canceled on checkout.session.expired", async () => {
    mockFindById.mockResolvedValueOnce(null);
    mockTryInsert.mockResolvedValueOnce({
      createdAt: "2026-01-01T00:00:00.000Z",
      payload: {},
      processedAt: null,
      stripeEventId: "evt_3",
      type: "checkout.session.expired",
    });
    const payment = makePayment();
    mockFindByCheckoutSessionId.mockResolvedValueOnce(payment);

    await processStripeWebhookEvent({
      created: 1,
      data: {
        object: {
          id: "cs_test_1",
          object: "checkout.session",
        },
      },
      id: "evt_3",
      livemode: false,
      object: "event",
      type: "checkout.session.expired",
    } as never);

    expect(mockMarkCanceled).toHaveBeenCalledWith(payment);
    expect(mockMarkProcessed).toHaveBeenCalledWith("evt_3");
  });

  test("marks failed on payment_intent.payment_failed", async () => {
    mockFindById.mockResolvedValueOnce(null);
    mockTryInsert.mockResolvedValueOnce({
      createdAt: "2026-01-01T00:00:00.000Z",
      payload: {},
      processedAt: null,
      stripeEventId: "evt_4",
      type: "payment_intent.payment_failed",
    });
    const payment = makePayment();
    mockFindByPaymentIntentId.mockResolvedValueOnce(payment);

    await processStripeWebhookEvent({
      created: 1,
      data: {
        object: {
          id: "pi_1",
          metadata: {},
          object: "payment_intent",
        },
      },
      id: "evt_4",
      livemode: false,
      object: "event",
      type: "payment_intent.payment_failed",
    } as never);

    expect(mockMarkFailed).toHaveBeenCalledWith(payment);
  });
});

describe("processStripeEventNotification", () => {
  beforeEach(() => {
    mockFindById.mockReset();
    mockTryInsert.mockReset();
    mockMarkProcessed.mockReset();
  });

  test("acks destination ping and marks processed", async () => {
    mockFindById.mockResolvedValueOnce(null);
    mockTryInsert.mockResolvedValueOnce({
      createdAt: "2026-01-01T00:00:00.000Z",
      payload: {},
      processedAt: null,
      stripeEventId: "evt_ping",
      type: "v2.core.event_destination.ping",
    });

    await processStripeEventNotification({
      created: "2026-07-16T12:28:53.624Z",
      id: "evt_ping",
      livemode: false,
      object: "v2.core.event",
      type: "v2.core.event_destination.ping",
    } as never);

    expect(mockTryInsert).toHaveBeenCalledTimes(1);
    expect(mockMarkProcessed).toHaveBeenCalledWith("evt_ping");
    expect(mockMarkSucceeded).not.toHaveBeenCalled();
  });
});
