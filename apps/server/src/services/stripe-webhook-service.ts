import type Stripe from "stripe";

import { stripeWebhookEventsDb } from "@/db/stripe-webhook-events";
import { tenantRentPaymentsDb } from "@/db/tenant-rent-payments";
import { tenantRentPaymentService } from "@/services/tenant-rent-payment-service";
import { WinstonLogger } from "@/services/winston";
import { constructStripeWebhookEvent } from "@/stripe/stripe-client";

function redactEventPayload(event: Stripe.Event): Record<string, unknown> {
  return {
    created: event.created,
    id: event.id,
    livemode: event.livemode,
    object: event.data.object && "object" in event.data.object ? event.data.object.object : null,
    type: event.type,
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

export async function processStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  const existing = await stripeWebhookEventsDb.findById(event.id);
  if (existing?.processedAt) {
    WinstonLogger.info({
      msg: "tenant_payments.webhook_duplicate",
      stripeEventId: event.id,
      type: event.type,
    });
    return;
  }

  if (!existing) {
    await stripeWebhookEventsDb.tryInsert({
      payload: redactEventPayload(event),
      stripeEventId: event.id,
      type: event.type,
    });
  }

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

  await stripeWebhookEventsDb.markProcessed(event.id);
}

export function verifyAndParseStripeWebhook(
  rawBody: Buffer | string,
  signatureHeader: string | string[] | undefined
): Stripe.Event {
  if (typeof signatureHeader !== "string" || !signatureHeader) {
    throw new StripeWebhookSignatureError("Missing Stripe-Signature header");
  }
  try {
    return constructStripeWebhookEvent(rawBody, signatureHeader);
  } catch (error) {
    throw new StripeWebhookSignatureError(
      error instanceof Error ? error.message : "Invalid Stripe signature"
    );
  }
}

export class StripeWebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeWebhookSignatureError";
  }
}
