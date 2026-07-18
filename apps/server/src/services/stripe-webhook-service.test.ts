import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { ITenantRentPayment } from "@/db/tenant-rent-payments";
import { TenantRentPaymentStatus } from "@/packages/shared";
import { makePayment } from "@/test-fixtures/domain";

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
const mockMarkRefunded = mock(() => Promise.resolve(null as unknown));
const mockPostDiscordWebhook = mock(() => Promise.resolve());
const mockLoggerInfo = mock(() => undefined);
const mockLoggerWarn = mock(() => undefined);
const mockLoggerError = mock(() => undefined);

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
    markRefunded: mockMarkRefunded,
    markSucceeded: mockMarkSucceeded,
  },
}));

mock.module("@/services/discord-webhook", () => ({
  postDiscordWebhook: mockPostDiscordWebhook,
}));

mock.module("@/services/winston", () => ({
  WinstonLogger: {
    error: mockLoggerError,
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
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

const { processStripeEventNotification, processStripeWebhookEvent } =
  await import("./stripe-webhook-service");


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
    mockMarkRefunded.mockReset();
    mockPostDiscordWebhook.mockReset();
    mockLoggerInfo.mockReset();
    mockLoggerWarn.mockReset();
    mockLoggerError.mockReset();
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
    const payment = makePayment({ amountCents: 100_00, idempotencyKey: "key-1", stripeCheckoutSessionId: "cs_test_1", stripePaymentIntentId: null });
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
    const payment = makePayment({ amountCents: 100_00, idempotencyKey: "key-1", stripeCheckoutSessionId: "cs_test_1", stripePaymentIntentId: null });
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
    const payment = makePayment({ amountCents: 100_00, idempotencyKey: "key-1", stripeCheckoutSessionId: "cs_test_1", stripePaymentIntentId: null });
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

  test("marks refunded on charge.refunded", async () => {
    mockFindById.mockResolvedValueOnce(null);
    mockTryInsert.mockResolvedValueOnce({
      createdAt: "2026-01-01T00:00:00.000Z",
      payload: {},
      processedAt: null,
      stripeEventId: "evt_5",
      type: "charge.refunded",
    });
    const payment = makePayment({
      status: TenantRentPaymentStatus.SUCCEEDED,
      stripePaymentIntentId: "pi_1",
    });
    mockFindByPaymentIntentId.mockResolvedValueOnce(payment);
    mockMarkRefunded.mockResolvedValueOnce({
      ...payment,
      status: TenantRentPaymentStatus.REFUNDED,
    });

    await processStripeWebhookEvent({
      created: 1,
      data: {
        object: {
          amount: 100_00,
          amount_refunded: 100_00,
          id: "ch_1",
          object: "charge",
          payment_intent: "pi_1",
        },
      },
      id: "evt_5",
      livemode: false,
      object: "event",
      type: "charge.refunded",
    } as never);

    expect(mockMarkRefunded).toHaveBeenCalledWith(payment, {
      amountRefundedCents: 100_00,
      chargeAmountCents: 100_00,
    });
    expect(mockMarkProcessed).toHaveBeenCalledWith("evt_5");
  });

  test("logs and notifies on charge.dispute.created", async () => {
    mockFindById.mockResolvedValueOnce(null);
    mockTryInsert.mockResolvedValueOnce({
      createdAt: "2026-01-01T00:00:00.000Z",
      payload: {},
      processedAt: null,
      stripeEventId: "evt_6",
      type: "charge.dispute.created",
    });
    const payment = makePayment({
      status: TenantRentPaymentStatus.SUCCEEDED,
      stripePaymentIntentId: "pi_1",
    });
    mockFindByPaymentIntentId.mockResolvedValueOnce(payment);

    await processStripeWebhookEvent({
      created: 1,
      data: {
        object: {
          amount: 100_00,
          currency: "usd",
          id: "dp_1",
          object: "dispute",
          payment_intent: "pi_1",
          reason: "fraudulent",
          status: "needs_response",
        },
      },
      id: "evt_6",
      livemode: false,
      object: "event",
      type: "charge.dispute.created",
    } as never);

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        disputeId: "dp_1",
        msg: "tenant_payments.dispute_created",
        paymentId: "payment-1",
      })
    );
    expect(mockPostDiscordWebhook).toHaveBeenCalledTimes(1);
    expect(mockMarkRefunded).not.toHaveBeenCalled();
    expect(mockMarkProcessed).toHaveBeenCalledWith("evt_6");
  });

  test("marks refunded on charge.dispute.closed lost", async () => {
    mockFindById.mockResolvedValueOnce(null);
    mockTryInsert.mockResolvedValueOnce({
      createdAt: "2026-01-01T00:00:00.000Z",
      payload: {},
      processedAt: null,
      stripeEventId: "evt_7",
      type: "charge.dispute.closed",
    });
    const payment = makePayment({
      status: TenantRentPaymentStatus.SUCCEEDED,
      stripePaymentIntentId: "pi_1",
    });
    mockFindByPaymentIntentId.mockResolvedValueOnce(payment);
    mockMarkRefunded.mockResolvedValueOnce({
      ...payment,
      status: TenantRentPaymentStatus.REFUNDED,
    });

    await processStripeWebhookEvent({
      created: 1,
      data: {
        object: {
          amount: 100_00,
          currency: "usd",
          id: "dp_1",
          object: "dispute",
          payment_intent: "pi_1",
          status: "lost",
        },
      },
      id: "evt_7",
      livemode: false,
      object: "event",
      type: "charge.dispute.closed",
    } as never);

    expect(mockMarkRefunded).toHaveBeenCalledWith(payment);
    expect(mockMarkProcessed).toHaveBeenCalledWith("evt_7");
  });

  test("logs only on charge.dispute.closed won", async () => {
    mockFindById.mockResolvedValueOnce(null);
    mockTryInsert.mockResolvedValueOnce({
      createdAt: "2026-01-01T00:00:00.000Z",
      payload: {},
      processedAt: null,
      stripeEventId: "evt_8",
      type: "charge.dispute.closed",
    });

    await processStripeWebhookEvent({
      created: 1,
      data: {
        object: {
          amount: 100_00,
          currency: "usd",
          id: "dp_2",
          object: "dispute",
          payment_intent: "pi_1",
          status: "won",
        },
      },
      id: "evt_8",
      livemode: false,
      object: "event",
      type: "charge.dispute.closed",
    } as never);

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        disputeId: "dp_2",
        disputeStatus: "won",
        msg: "tenant_payments.dispute_closed",
      })
    );
    expect(mockMarkRefunded).not.toHaveBeenCalled();
    expect(mockFindByPaymentIntentId).not.toHaveBeenCalled();
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
