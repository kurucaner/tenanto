import Stripe from "stripe";

import { propertyStripeAccountsDb } from "@/db/property-stripe-accounts";
import { stripeWebhookEventsDb } from "@/db/stripe-webhook-events";
import { type ITenantRentPayment, tenantRentPaymentsDb } from "@/db/tenant-rent-payments";
import { stripeWebhookSignatureError } from "@/errors/stripe-errors";
import { stripeConnectAccountFlagsFromStripeAccount } from "@/lib/stripe-connect-account-flags";
import {
  bookAchReturnFeeExpenseForRentPayment,
  reverseProcessingFeeExpenseOnRentRefund,
} from "@/services/book-stripe-processing-fee-expense";
import { postDiscordWebhook } from "@/services/discord-webhook";
import {
  buildTenantRentPaymentLogFields,
  logTenantRentPaymentWebhookProcessed,
} from "@/services/tenant-rent-payment-observability";
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

function paymentIntentIdFromCheckoutSession(session: Stripe.Checkout.Session): string | null {
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : (session.payment_intent?.id ?? null);
}

async function syncCheckoutSessionStripeIds(
  payment: ITenantRentPayment,
  session: Stripe.Checkout.Session
): Promise<ITenantRentPayment> {
  const paymentIntentId = paymentIntentIdFromCheckoutSession(session);
  if (
    payment.stripeCheckoutSessionId === session.id &&
    (!paymentIntentId || payment.stripePaymentIntentId === paymentIntentId)
  ) {
    return payment;
  }

  const updated = await tenantRentPaymentsDb.updateStripeIds(payment.id, {
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
  });
  if (updated) {
    return updated;
  }
  return {
    ...payment,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId ?? payment.stripePaymentIntentId,
  };
}

async function notifyTenantPaymentDisputeCreated(
  dispute: Stripe.Dispute,
  payment: ITenantRentPayment | null
): Promise<void> {
  WinstonLogger.warn({
    ...(payment ? buildTenantRentPaymentLogFields(payment) : {}),
    amountCents: dispute.amount,
    currency: dispute.currency,
    disputeId: dispute.id,
    disputeReason: dispute.reason,
    disputeStatus: dispute.status,
    eventType: "charge.dispute.created",
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

  const synced = await syncCheckoutSessionStripeIds(payment, session);
  await tenantRentPaymentService.markSucceeded(synced, paymentIntentIdFromCheckoutSession(session));
  logTenantRentPaymentWebhookProcessed({
    eventType: "checkout.session.completed",
    payment: synced,
  });
}

async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session): Promise<void> {
  const payment = await resolvePaymentFromCheckoutSession(session);
  if (!payment) return;
  await tenantRentPaymentService.markCanceled(payment);
  logTenantRentPaymentWebhookProcessed({
    eventType: "checkout.session.expired",
    payment,
  });
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const payment = await resolvePaymentFromPaymentIntent(paymentIntent);
  if (!payment) return;
  await tenantRentPaymentService.markFailed(payment);
  logTenantRentPaymentWebhookProcessed({
    eventType: "payment_intent.payment_failed",
    payment,
  });
}

async function handlePaymentIntentProcessing(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const payment = await resolvePaymentFromPaymentIntent(paymentIntent);
  if (!payment) return;
  await tenantRentPaymentService.markProcessing(payment, paymentIntent.id);
  logTenantRentPaymentWebhookProcessed({
    eventType: "payment_intent.processing",
    payment,
  });
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const payment = await resolvePaymentFromPaymentIntent(paymentIntent);
  if (!payment) return;
  await tenantRentPaymentService.markSucceeded(payment, paymentIntent.id);
  logTenantRentPaymentWebhookProcessed({
    eventType: "payment_intent.succeeded",
    payment,
  });
}

async function handleCheckoutSessionAsyncPaymentSucceeded(
  session: Stripe.Checkout.Session
): Promise<void> {
  const payment = await resolvePaymentFromCheckoutSession(session);
  if (!payment) {
    WinstonLogger.warn({
      msg: "tenant_payments.async_payment_succeeded_unknown_payment",
      sessionId: session.id,
    });
    return;
  }

  const synced = await syncCheckoutSessionStripeIds(payment, session);
  await tenantRentPaymentService.markSucceeded(synced, paymentIntentIdFromCheckoutSession(session));
  logTenantRentPaymentWebhookProcessed({
    eventType: "checkout.session.async_payment_succeeded",
    payment: synced,
  });
}

async function handleCheckoutSessionAsyncPaymentFailed(
  session: Stripe.Checkout.Session
): Promise<void> {
  const payment = await resolvePaymentFromCheckoutSession(session);
  if (!payment) {
    WinstonLogger.warn({
      msg: "tenant_payments.async_payment_failed_unknown_payment",
      sessionId: session.id,
    });
    return;
  }

  const paymentIntentId = paymentIntentIdFromCheckoutSession(session);
  let target = payment;
  if (paymentIntentId && !payment.stripePaymentIntentId) {
    target = await syncCheckoutSessionStripeIds(payment, session);
  }

  await tenantRentPaymentService.markFailed(target);
  logTenantRentPaymentWebhookProcessed({
    eventType: "checkout.session.async_payment_failed",
    payment: target,
  });
}

async function handleChargeFailed(charge: Stripe.Charge): Promise<void> {
  const payment = await resolvePaymentFromCharge(charge);
  if (!payment) {
    WinstonLogger.info({
      chargeId: charge.id,
      msg: "tenant_payments.charge_failed_unknown_payment",
      paymentIntentId:
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : (charge.payment_intent?.id ?? null),
    });
    return;
  }

  try {
    await bookAchReturnFeeExpenseForRentPayment(payment, { charge });
    logTenantRentPaymentWebhookProcessed({
      eventType: "charge.failed",
      payment,
    });
  } catch (error) {
    WinstonLogger.error({
      ...buildTenantRentPaymentLogFields(payment),
      chargeId: charge.id,
      err: error,
      eventType: "ach_return_fee_expense_failed",
      msg: "tenant_payments.ach_return_fee_expense_failed",
    });
  }
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
  logTenantRentPaymentWebhookProcessed({
    eventType: "charge.refunded",
    payment,
  });

  try {
    await reverseProcessingFeeExpenseOnRentRefund(payment, charge);
  } catch (error) {
    WinstonLogger.error({
      ...buildTenantRentPaymentLogFields(payment),
      chargeId: charge.id,
      err: error,
      eventType: "processing_fee_expense_refund_failed",
      msg: "tenant_payments.processing_fee_expense_refund_failed",
    });
  }
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
  logTenantRentPaymentWebhookProcessed({
    eventType: "charge.dispute.closed",
    payment,
  });
}

async function handleAccountUpdated(account: Stripe.Account): Promise<void> {
  const local = await propertyStripeAccountsDb.findByStripeAccountId(account.id);
  if (!local) {
    WinstonLogger.info({
      msg: "tenant_payments.connect_account_updated_unknown",
      stripeAccountId: account.id,
    });
    return;
  }

  const flags = stripeConnectAccountFlagsFromStripeAccount(account);
  await propertyStripeAccountsDb.updateFlags(local.propertyId, flags);

  WinstonLogger.info({
    accountType: local.accountType,
    msg: "tenant_payments.connect_account_updated",
    propertyId: local.propertyId,
    stripeAccountId: account.id,
    ...flags,
  });
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
      eventType: input.type,
      msg: "tenant_payments.webhook_duplicate",
      stripeEventId: input.stripeEventId,
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
        case "checkout.session.async_payment_succeeded":
          await handleCheckoutSessionAsyncPaymentSucceeded(
            event.data.object as Stripe.Checkout.Session
          );
          break;
        case "checkout.session.async_payment_failed":
          await handleCheckoutSessionAsyncPaymentFailed(
            event.data.object as Stripe.Checkout.Session
          );
          break;
        case "payment_intent.processing":
          await handlePaymentIntentProcessing(event.data.object as Stripe.PaymentIntent);
          break;
        case "payment_intent.succeeded":
          await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;
        case "payment_intent.payment_failed":
          await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;
        case "charge.failed":
          await handleChargeFailed(event.data.object as Stripe.Charge);
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
        case "account.updated":
          await handleAccountUpdated(event.data.object as Stripe.Account);
          break;
        default:
          WinstonLogger.info({
            eventType: event.type,
            msg: "tenant_payments.webhook_ignored",
            stripeEventId: event.id,
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
