import type Stripe from "stripe";

import { tenantRentPaymentsDb } from "@/db/tenant-rent-payments";
import { isStripeConnectEnabled } from "@/lib/stripe-connect-config";
import {
  TENANT_RENT_PAYMENT_RECONCILE_LOOKBACK_HOURS,
  TENANT_RENT_PAYMENT_RECONCILE_STRIPE_LIMIT,
} from "@/lib/tenant-rent-payment-config";
import { TenantRentPaymentStatus } from "@/packages/shared";
import { tenantRentPaymentService } from "@/services/tenant-rent-payment-service";
import { WinstonLogger } from "@/services/winston";
import { getStripeClient, isStripeSecretConfigured } from "@/stripe/stripe-client";

export interface IRentPaymentReconcileResult {
  gaps: number;
  recovered: number;
  scannedLocal: number;
  scannedStripe: number;
}

function lookbackSince(now = new Date()): Date {
  return new Date(now.getTime() - TENANT_RENT_PAYMENT_RECONCILE_LOOKBACK_HOURS * 60 * 60 * 1000);
}

async function recoverPayment(
  paymentId: string,
  stripePaymentIntentId: string,
  source: "local_open" | "stripe_succeeded"
): Promise<"already_succeeded" | "gap" | "recovered"> {
  const payment = await tenantRentPaymentsDb.findById(paymentId);
  if (!payment) {
    WinstonLogger.warn({
      msg: "tenant_payments.reconcile_gap",
      paymentId,
      reason: "local_payment_missing",
      source,
      stripePaymentIntentId,
    });
    return "gap";
  }

  if (payment.status === TenantRentPaymentStatus.SUCCEEDED) {
    return "already_succeeded";
  }

  try {
    await tenantRentPaymentService.markSucceeded(payment, stripePaymentIntentId);
    WinstonLogger.info({
      msg: "tenant_payments.reconcile_recovered",
      paymentId: payment.id,
      previousStatus: payment.status,
      source,
      stripePaymentIntentId,
    });
    return "recovered";
  } catch (error) {
    WinstonLogger.warn({
      err: error instanceof Error ? { message: error.message, name: error.name } : undefined,
      msg: "tenant_payments.reconcile_gap",
      paymentId: payment.id,
      reason: "mark_succeeded_failed",
      source,
      stripePaymentIntentId,
    });
    return "gap";
  }
}

/**
 * Failsafe: Stripe succeeded but local row not succeeded → apply income path.
 * Never trusts browser return URLs; only Stripe PaymentIntent status.
 */
export async function reconcileTenantRentPayments(
  now = new Date()
): Promise<IRentPaymentReconcileResult> {
  const result: IRentPaymentReconcileResult = {
    gaps: 0,
    recovered: 0,
    scannedLocal: 0,
    scannedStripe: 0,
  };

  if (!isStripeConnectEnabled() || !isStripeSecretConfigured()) {
    WinstonLogger.info({
      msg: "tenant_payments.reconcile_skipped",
      reason: "stripe_not_configured",
    });
    return result;
  }

  const since = lookbackSince(now);
  const sinceUnix = Math.floor(since.getTime() / 1000);
  const stripe = getStripeClient();
  const seenPaymentIds = new Set<string>();

  const localOpen = await tenantRentPaymentsDb.listReconcileCandidatesSince(since);
  result.scannedLocal = localOpen.length;

  for (const payment of localOpen) {
    const piId = payment.stripePaymentIntentId;
    if (!piId) continue;
    seenPaymentIds.add(payment.id);

    let intent: Stripe.PaymentIntent;
    try {
      intent = await stripe.paymentIntents.retrieve(piId);
    } catch (error) {
      WinstonLogger.warn({
        err: error instanceof Error ? { message: error.message, name: error.name } : undefined,
        msg: "tenant_payments.reconcile_gap",
        paymentId: payment.id,
        reason: "payment_intent_retrieve_failed",
        source: "local_open",
        stripePaymentIntentId: piId,
      });
      result.gaps += 1;
      continue;
    }

    if (intent.status === "succeeded") {
      const outcome = await recoverPayment(payment.id, piId, "local_open");
      if (outcome === "recovered") result.recovered += 1;
      else if (outcome === "gap") result.gaps += 1;
      continue;
    }

    if (intent.status === "processing") {
      if (payment.status !== TenantRentPaymentStatus.PROCESSING) {
        await tenantRentPaymentService.markProcessing(payment, piId);
        WinstonLogger.info({
          msg: "tenant_payments.reconcile_processing",
          paymentId: payment.id,
          stripePaymentIntentId: piId,
        });
      }
      continue;
    }

    if (intent.status === "canceled") {
      await tenantRentPaymentService.markCanceled(payment);
      WinstonLogger.info({
        msg: "tenant_payments.reconcile_canceled",
        paymentId: payment.id,
        stripePaymentIntentId: piId,
      });
    }
  }

  const list = await stripe.paymentIntents.list({
    created: { gte: sinceUnix },
    limit: TENANT_RENT_PAYMENT_RECONCILE_STRIPE_LIMIT,
  });
  result.scannedStripe = list.data.length;

  for (const intent of list.data) {
    if (intent.status !== "succeeded") continue;

    const paymentId = intent.metadata?.paymentId?.trim();
    if (!paymentId) continue;

    if (seenPaymentIds.has(paymentId)) continue;
    seenPaymentIds.add(paymentId);

    const local = await tenantRentPaymentsDb.findById(paymentId);
    if (!local) {
      WinstonLogger.warn({
        msg: "tenant_payments.reconcile_gap",
        paymentId,
        reason: "stripe_succeeded_without_local_row",
        source: "stripe_succeeded",
        stripePaymentIntentId: intent.id,
      });
      result.gaps += 1;
      continue;
    }

    if (local.status === TenantRentPaymentStatus.SUCCEEDED) continue;

    const outcome = await recoverPayment(local.id, intent.id, "stripe_succeeded");
    if (outcome === "recovered") result.recovered += 1;
    else if (outcome === "gap") result.gaps += 1;
  }

  WinstonLogger.info({
    gaps: result.gaps,
    msg: "tenant_payments.reconcile_completed",
    recovered: result.recovered,
    scannedLocal: result.scannedLocal,
    scannedStripe: result.scannedStripe,
  });

  return result;
}
