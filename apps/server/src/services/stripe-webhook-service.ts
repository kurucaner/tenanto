import Stripe from "stripe";

import { stripeWebhookEventsDb } from "@/db/stripe-webhook-events";
import { type ITenantRentPayment, tenantRentPaymentsDb } from "@/db/tenant-rent-payments";
import { stripeWebhookSignatureError } from "@/errors/stripe-errors";
import { postDiscordWebhook } from "@/services/discord-webhook";
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

async function resolvePaymentFromPaymentIntentId(paymentIntentId: string) {
  return tenantRentPaymentsDb.findByPaymentIntentId(paymentIntentId);
}

async function resolvePaymentFromPaymentIntent(paymentIntent: Stripe.PaymentIntent) {
  const paymentId = paymentIntent.metadata?.paymentId;
  if (paymentId) {
    const byMeta = await tenantRentPaymentsDb.findById(paymentId);
    if (byMeta) return byMeta;
  }
  return tenantRentPaymentsDb.findByPaymentIntentId(paymentIntent.id);
}

async function resolvePaymentFromCharge(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : (charge.payment_intent?.id ?? null);
  if (!paymentIntentId) return null;
  return resolvePaymentFromPaymentIntentId(paymentIntentId);
}

function disputePaymentIntentId(dispute: Stripe.Dispute): string | null {
  return typeof dispute.payment_intent === "string"
    ? dispute.payment_intent
    : (dispute.payment_intent?.id ?? null);
}

async function resolvePaymentFromDispute(dispute: Stripe.Dispute) {
  const paymentIntentId = disputePaymentIntentId(dispute);
  if (!paymentIntentId) return null;
  return resolvePaymentFromPaymentIntentId(paymentIntentId);
}

async function notifyTenantPaymentDisputeCreated(
  dispute: Stripe.Dispute,
  payment: ITenantRentPayment | null
): Promise<void> {
  WinstonLogger.warn({
    amountCents: dispute.amount,
    currency: dispute.currency,
    disputeId: dispute.id,
    disputeReason: dispute.reason,
    disputeStatus: dispute.status,
    leaseId: payment?.leaseId ?? null,
    msg: "tenant_payments.dispute_created",
    paymentId: payment?.id ?? null,
    propertyId: payment?.propertyId ?? null,
  });

  try {
    await postDiscordWebhook(process.env.DISCORD_TENANT_PAYMENTS_WEBHOOK_URL, {
      embeds: [
        {
          color: 0xdc2626,
          fields: [
            { inline: true, name: "Dispute", value: dispute.id },
            {
              inline: true,
              name: "Amount",
              value: `${(dispute.amount / 100).toFixed(2)} ${dispute.currency.toUpperCase()}`,
            },
            { inline: true, name: "Reason", value: dispute.reason ?? "unknown" },
            { inline: true, name: "Payment", value: payment?.id ?? "unknown" },
            { inline: true, name: "Lease", value: payment?.leaseId ?? "unknown" },
            { inline: true, name: "Property", value: payment?.propertyId ?? "unknown" },
          ],
          timestamp: new Date().toISOString(),
          title: "Tenant rent dispute opened",
        },
      ],
    });
  } catch (error) {
    WinstonLogger.error({
      disputeId: dispute.id,
      err: error,
      msg: "tenant_payments.dispute_discord_failed",
    });
  }
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

async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const payment = await resolvePaymentFromCharge(charge);
  if (!payment) {
    WinstonLogger.warn({
      chargeId: charge.id,
      msg: "tenant_payments.charge_refunded_unknown_payment",
      paymentIntentId:
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : (charge.payment_intent?.id ?? null),
    });
    return;
  }

  await tenantRentPaymentService.markRefunded(payment, {
    amountRefundedCents: charge.amount_refunded,
    chargeAmountCents: charge.amount,
  });
}

async function handleChargeDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
  const payment = await resolvePaymentFromDispute(dispute);
  await notifyTenantPaymentDisputeCreated(dispute, payment);
}

async function handleChargeDisputeClosed(dispute: Stripe.Dispute): Promise<void> {
  if (dispute.status === "won" || dispute.status === "warning_closed") {
    WinstonLogger.info({
      disputeId: dispute.id,
      disputeStatus: dispute.status,
      msg: "tenant_payments.dispute_closed",
    });
    return;
  }

  if (dispute.status !== "lost") {
    WinstonLogger.info({
      disputeId: dispute.id,
      disputeStatus: dispute.status,
      msg: "tenant_payments.dispute_closed_unhandled",
    });
    return;
  }

  const payment = await resolvePaymentFromDispute(dispute);
  if (!payment) {
    WinstonLogger.warn({
      disputeId: dispute.id,
      msg: "tenant_payments.dispute_closed_unknown_payment",
      paymentIntentId: disputePaymentIntentId(dispute),
    });
    return;
  }

  await tenantRentPaymentService.markRefunded(payment);
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
        case "charge.refunded":
          await handleChargeRefunded(event.data.object as Stripe.Charge);
          break;
        case "charge.dispute.created":
          await handleChargeDisputeCreated(event.data.object as Stripe.Dispute);
          break;
        case "charge.dispute.closed":
          await handleChargeDisputeClosed(event.data.object as Stripe.Dispute);
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
    throw stripeWebhookSignatureError("Invalid signature");
  }
  try {
    return verifyStripeWebhookPayload(rawBody, signatureHeader);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      throw stripeWebhookSignatureError("Invalid signature");
    }
    throw error;
  }
}
