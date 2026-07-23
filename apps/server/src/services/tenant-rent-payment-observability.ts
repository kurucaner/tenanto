import Stripe from "stripe";

import type { ITenantRentPayment } from "@/db/tenant-rent-payments";
import type { TRentPaymentMethodFamily } from "@/packages/shared";

import { WinstonLogger } from "./winston";

export interface ITenantRentPaymentLogFields {
  amountCents: number;
  chargeCents: number;
  feeCents: number;
  leaseId: string;
  method: TRentPaymentMethodFamily | null;
  paymentId: string;
  propertyId: string;
}

export function buildTenantRentPaymentLogFields(
  payment: ITenantRentPayment
): ITenantRentPaymentLogFields {
  return {
    amountCents: payment.amountCents,
    chargeCents: payment.chargeCents,
    feeCents: payment.feeCents,
    leaseId: payment.leaseId,
    method: payment.paymentMethodFamily,
    paymentId: payment.id,
    propertyId: payment.propertyId,
  };
}

export function logTenantRentPaymentCheckoutCreated(input: {
  amountCents: number;
  chargeCents: number;
  feeCents: number;
  leaseId: string;
  method: TRentPaymentMethodFamily;
  paymentId: string;
  stripeCheckoutSessionId: string;
}): void {
  WinstonLogger.info({
    amountCents: input.amountCents,
    chargeCents: input.chargeCents,
    eventType: "checkout_created",
    feeCents: input.feeCents,
    leaseId: input.leaseId,
    method: input.method,
    msg: "tenant_payments.checkout_created",
    paymentId: input.paymentId,
    stripeCheckoutSessionId: input.stripeCheckoutSessionId,
  });
}

export function logTenantRentPaymentIntentCreated(input: {
  amountCents: number;
  chargeCents: number;
  feeCents: number;
  leaseId: string;
  method: TRentPaymentMethodFamily;
  paymentId: string;
  stripePaymentIntentId: string;
}): void {
  WinstonLogger.info({
    amountCents: input.amountCents,
    chargeCents: input.chargeCents,
    eventType: "payment_intent_created",
    feeCents: input.feeCents,
    leaseId: input.leaseId,
    method: input.method,
    msg: "tenant_payments.payment_intent_created",
    paymentId: input.paymentId,
    stripePaymentIntentId: input.stripePaymentIntentId,
  });
}

export function logTenantRentPaymentStatusTransition(input: {
  eventType:
    | "rent_payment_canceled"
    | "rent_payment_failed"
    | "rent_payment_processing"
    | "rent_payment_refunded"
    | "rent_payment_succeeded";
  payment: ITenantRentPayment;
  previousStatus?: string;
  stripePaymentIntentId?: string | null;
}): void {
  WinstonLogger.info({
    ...buildTenantRentPaymentLogFields(input.payment),
    eventType: input.eventType,
    msg: `tenant_payments.${input.eventType}`,
    previousStatus: input.previousStatus,
    stripePaymentIntentId: input.stripePaymentIntentId ?? input.payment.stripePaymentIntentId,
  });
}

export function logTenantRentPaymentWebhookProcessed(input: {
  eventType: string;
  payment: ITenantRentPayment;
  stripeEventId?: string;
}): void {
  WinstonLogger.info({
    ...buildTenantRentPaymentLogFields(input.payment),
    eventType: input.eventType,
    msg: "tenant_payments.webhook_processed",
    stripeEventId: input.stripeEventId,
  });
}

function classifyStripeRentPaymentCreateFailure(error: unknown): {
  eventType: "application_fee_create_failed";
  failureReason: string;
} | null {
  if (!(error instanceof Stripe.errors.StripeError)) {
    return null;
  }

  const code = error.code ?? "";
  const message = error.message.toLowerCase();
  const applicationFeeRelated =
    code.includes("application_fee") ||
    message.includes("application fee") ||
    message.includes("application_fee");

  if (!applicationFeeRelated) {
    return null;
  }

  return {
    eventType: "application_fee_create_failed",
    failureReason: code || error.message,
  };
}

export function logTenantRentPaymentCreateFailed(input: {
  chargeCents?: number;
  err: unknown;
  eventType: "checkout_failed" | "payment_intent_failed";
  feeCents?: number;
  leaseId: string;
  method?: TRentPaymentMethodFamily;
  tenantUserId: string;
}): void {
  const stripeFailure = classifyStripeRentPaymentCreateFailure(input.err);

  WinstonLogger.error({
    ...(input.chargeCents != null ? { chargeCents: input.chargeCents } : {}),
    err: input.err,
    eventType: stripeFailure?.eventType ?? input.eventType,
    ...(stripeFailure ? { failureReason: stripeFailure.failureReason } : {}),
    ...(input.feeCents != null ? { feeCents: input.feeCents } : {}),
    leaseId: input.leaseId,
    ...(input.method ? { method: input.method } : {}),
    msg: `tenant_payments.${input.eventType}`,
    tenantUserId: input.tenantUserId,
  });
}
