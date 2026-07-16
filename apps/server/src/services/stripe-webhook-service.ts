import Stripe from "stripe";

import { stripeWebhookEventsDb } from "@/db/stripe-webhook-events";
import { tenantRentPaymentsDb } from "@/db/tenant-rent-payments";
import { tenantRentPaymentService } from "@/services/tenant-rent-payment-service";
import { WinstonLogger } from "@/services/winston";
import { type TVerifiedStripeWebhook, verifyStripeWebhookPayload } from "@/stripe/stripe-client";

function redactEventPayload(event: Stripe.Event): Record<string, unknown> {
  return {
    created: event.created,
    id: event.id,
    livemode: event.livemode,
    object: event.data.object && "object" in event.data.object ? event.data.object.object : null,
    type: event.type,
  };
}

function redactThinNotificationPayload(
  notification: Stripe.V2.Core.EventNotification
): Record<string, unknown> {
  return {
    created: notification.created,
    id: notification.id,
    livemode: notification.livemode,
    object: "v2.core.event",
    type: notification.type,
  };
}

async function resolvePaymentFromCheckoutSession(session: Stripe.Checkout.Session) {
  const paymentId = session.metadata?.paymentId;
  if (paymentId) {
    const byMeta = await tenantRentPaymentsDb.findById(paymentId);
    if (byMeta) return byMeta;
  }
  return tenantRentPaymentsDb.findByCheckoutSessionId(session.id);
}

async function resolvePaymentFromPaymentIntent(paymentIntent: Stripe.PaymentIntent) {
  const paymentId = paymentIntent.metadata?.paymentId;
  if (paymentId) {
    const byMeta = await tenantRentPaymentsDb.findById(paymentId);
    if (byMeta) return byMeta;
  }
  return tenantRentPaymentsDb.findByPaymentIntentId(paymentIntent.id);
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    WinstonLogger.info({
      msg: "tenant_payments.checkout_completed_unpaid",
      paymentStatus: session.payment_status,
      sessionId: session.id,
    });
    return;
  }

  const payment = await resolvePaymentFromCheckoutSession(session);
  if (!payment) {
    WinstonLogger.warn({
      msg: "tenant_payments.checkout_completed_unknown_payment",
      sessionId: session.id,
    });
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  await tenantRentPaymentsDb.updateStripeIds(payment.id, {
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
  });

  await tenantRentPaymentService.markSucceeded(payment, paymentIntentId);
}

async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session): Promise<void> {
  const payment = await resolvePaymentFromCheckoutSession(session);
  if (!payment) return;
  await tenantRentPaymentService.markCanceled(payment);
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const payment = await resolvePaymentFromPaymentIntent(paymentIntent);
  if (!payment) return;
  await tenantRentPaymentService.markFailed(payment);
}

async function recordAndProcessEvent(input: {
  payload: Record<string, unknown>;
  stripeEventId: string;
  type: string;
  handle: () => Promise<void>;
}): Promise<void> {
  const existing = await stripeWebhookEventsDb.findById(input.stripeEventId);
  if (existing?.processedAt) {
    WinstonLogger.info({
      msg: "tenant_payments.webhook_duplicate",
      stripeEventId: input.stripeEventId,
      type: input.type,
    });
    return;
  }

  if (!existing) {
    await stripeWebhookEventsDb.tryInsert({
      payload: input.payload,
      stripeEventId: input.stripeEventId,
      type: input.type,
    });
  }

  await input.handle();
  await stripeWebhookEventsDb.markProcessed(input.stripeEventId);
}

export async function processStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  await recordAndProcessEvent({
    handle: async () => {
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        case "checkout.session.expired":
          await handleCheckoutSessionExpired(event.data.object as Stripe.Checkout.Session);
          break;
        case "payment_intent.payment_failed":
          await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;
        default:
          WinstonLogger.info({
            msg: "tenant_payments.webhook_ignored",
            stripeEventId: event.id,
            type: event.type,
          });
          break;
      }
    },
    payload: redactEventPayload(event),
    stripeEventId: event.id,
    type: event.type,
  });
}

/** Thin Event Destination notifications (pings + future thin checkout events). */
export async function processStripeEventNotification(
  notification: Stripe.V2.Core.EventNotification
): Promise<void> {
  await recordAndProcessEvent({
    handle: async () => {
      if (notification.type === "v2.core.event_destination.ping") {
        WinstonLogger.info({
          msg: "tenant_payments.webhook_destination_ping",
          stripeEventId: notification.id,
        });
        return;
      }

      WinstonLogger.info({
        msg: "tenant_payments.webhook_thin_ignored",
        stripeEventId: notification.id,
        type: notification.type,
      });
    },
    payload: redactThinNotificationPayload(notification),
    stripeEventId: notification.id,
    type: notification.type,
  });
}

export async function processVerifiedStripeWebhook(
  verified: TVerifiedStripeWebhook
): Promise<void> {
  if (verified.kind === "snapshot") {
    await processStripeWebhookEvent(verified.event);
    return;
  }
  await processStripeEventNotification(verified.notification);
}

export function verifyAndParseStripeWebhook(
  rawBody: Buffer | string,
  signatureHeader: string | string[] | undefined
): TVerifiedStripeWebhook {
  if (typeof signatureHeader !== "string" || !signatureHeader) {
    throw new StripeWebhookSignatureError("Missing Stripe-Signature header");
  }
  try {
    return verifyStripeWebhookPayload(rawBody, signatureHeader);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      throw new StripeWebhookSignatureError(error.message);
    }
    throw error;
  }
}

export class StripeWebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeWebhookSignatureError";
  }
}
