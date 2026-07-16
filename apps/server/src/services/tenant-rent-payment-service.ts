import { isPostgresUniqueViolation } from "@/db/pg-errors";
import { propertyIncomeLineTypesDb } from "@/db/property-income-line-types";
import { propertyIncomeLinesDb } from "@/db/property-income-lines";
import { propertyLongStaysDb } from "@/db/property-long-stays";
import { propertyStripeAccountsDb } from "@/db/property-stripe-accounts";
import { type ITenantRentPayment, tenantRentPaymentsDb } from "@/db/tenant-rent-payments";
import { getTodayUtcIsoDate } from "@/lib/validate-create-expense-body";
import {
  buildRentCheckoutIdempotencyKey,
  calculateMiscIncomeLine,
  centsToDollars,
  computeRemainingByMonth,
  dollarsToCents,
  type ITenantCreateRentCheckoutBody,
  type ITenantCreateRentCheckoutResponse,
  type ITenantLeaseBalanceResponse,
  type ITenantRentPaymentStatusResponse,
  resolveRentIncomeLineTypeId,
  sumAmountDueCents,
  TenantRentPaymentStatus,
  transactionDateToMonth,
  validateCreateRentCheckoutBody,
} from "@/packages/shared";
import { assertLeaseTenantAccess } from "@/services/tenant-portal-access";
import { WinstonLogger } from "@/services/winston";
import { getStripeClient, isStripeSecretConfigured } from "@/stripe/stripe-client";

import { StripeConnectNotConfiguredError } from "./property-stripe-connect-service";

export class RentPaymentConnectNotReadyError extends Error {
  constructor(message = "Property Stripe Connect account is not ready to accept payments") {
    super(message);
    this.name = "RentPaymentConnectNotReadyError";
  }
}

export class RentPaymentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RentPaymentValidationError";
  }
}

export class RentPaymentNotFoundError extends Error {
  constructor(message = "Payment not found") {
    super(message);
    this.name = "RentPaymentNotFoundError";
  }
}

function tenantAppBaseUrl(): string {
  const base = process.env.TENANT_APP_URL?.trim().replace(/\/$/, "");
  if (!base) {
    throw new Error("TENANT_APP_URL is not configured");
  }
  return base;
}

function requireStripeConfigured(): void {
  if (!isStripeSecretConfigured()) {
    throw new StripeConnectNotConfiguredError();
  }
}

async function buildBalancePeriods(leaseId: string) {
  const schedule = await propertyLongStaysDb.getRentSchedule(leaseId);
  const months = schedule.map((row) => row.month);
  const allocationTotals = await tenantRentPaymentsDb.sumSucceededAllocatedCentsByMonths(
    leaseId,
    months
  );

  const inputs = schedule.map((row) => {
    const expectedCents = dollarsToCents(row.expectedRent);
    const fromIncome = row.isPaid ? expectedCents : 0;
    const fromAllocations = allocationTotals.get(row.month) ?? 0;
    const paidCents = Math.min(expectedCents, Math.max(fromIncome, fromAllocations));
    return {
      expectedCents,
      month: row.month,
      paidCents,
    };
  });

  return computeRemainingByMonth(inputs);
}

function toStatusResponse(payment: ITenantRentPayment): ITenantRentPaymentStatusResponse {
  return {
    amountCents: payment.amountCents,
    currency: payment.currency,
    id: payment.id,
    leaseId: payment.leaseId,
    status: payment.status,
  };
}

/**
 * Create income lines for months fully covered by succeeded allocations.
 * Skips months that already have schedule income (isPaid).
 */
export async function applyIncomeForFullyCoveredMonths(payment: ITenantRentPayment): Promise<void> {
  const allocations = await tenantRentPaymentsDb.listAllocations(payment.id);
  if (allocations.length === 0) return;

  const lease = await propertyLongStaysDb.findById(payment.leaseId);
  if (!lease) {
    throw new Error(`Lease ${payment.leaseId} not found while applying rent payment`);
  }

  const schedule = await propertyLongStaysDb.getRentSchedule(payment.leaseId);
  const paidMonths = new Set(schedule.filter((m) => m.isPaid).map((m) => m.month));

  const types = await propertyIncomeLineTypesDb.findByProperty(payment.propertyId);
  const incomeLineTypeId = resolveRentIncomeLineTypeId(types);
  if (!incomeLineTypeId) {
    throw new Error(`No income line type configured for property ${payment.propertyId}`);
  }

  for (const allocation of allocations) {
    if (paidMonths.has(allocation.periodMonth)) {
      continue;
    }

    const totalAllocated = await tenantRentPaymentsDb.sumSucceededAllocatedCents(
      payment.leaseId,
      allocation.periodMonth
    );
    const expectedCents = allocation.expectedCentsSnapshot;
    if (totalAllocated < expectedCents) {
      continue;
    }

    const amountDollars = centsToDollars(expectedCents);
    const computed = calculateMiscIncomeLine(amountDollars);
    await propertyIncomeLinesDb.create(
      payment.propertyId,
      {
        amount: amountDollars,
        description: `Tenant rent payment (${allocation.periodMonth})`,
        guestName: null,
        incomeLineTypeId,
        longStayId: payment.leaseId,
        reservationId: null,
        transactionDate: `${allocation.periodMonth}-01`,
        unitId: lease.unitId,
      },
      computed
    );
    paidMonths.add(allocation.periodMonth);
  }
}

export const tenantRentPaymentService = {
  async createCheckout(
    leaseId: string,
    tenantUserId: string,
    body: ITenantCreateRentCheckoutBody
  ): Promise<ITenantCreateRentCheckoutResponse> {
    await assertLeaseTenantAccess(leaseId, tenantUserId);
    requireStripeConfigured();

    if (body.leaseId.trim() !== leaseId) {
      throw new RentPaymentValidationError("leaseId in body must match path");
    }

    const lease = await propertyLongStaysDb.findById(leaseId);
    if (!lease) {
      throw new RentPaymentNotFoundError("Lease not found");
    }

    const connect = await propertyStripeAccountsDb.findByPropertyId(lease.propertyId);
    if (!connect?.chargesEnabled) {
      throw new RentPaymentConnectNotReadyError();
    }

    const periods = await buildBalancePeriods(leaseId);
    const validated = validateCreateRentCheckoutBody({
      amountCents: body.amountCents,
      leaseId,
      periodMonths: body.periodMonths,
      periods,
    });
    if (!validated.ok) {
      throw new RentPaymentValidationError(validated.error);
    }

    const idempotencyKey = buildRentCheckoutIdempotencyKey({
      amountCents: body.amountCents,
      leaseId,
      periodMonths: body.periodMonths,
      tenantUserId,
    });

    let payment: ITenantRentPayment;
    try {
      payment = await tenantRentPaymentsDb.createWithAllocations({
        allocations: validated.allocations.map((a) => ({
          allocatedCents: a.allocatedCents,
          expectedCentsSnapshot: a.expectedCentsSnapshot,
          periodMonth: a.month,
        })),
        amountCents: body.amountCents,
        connectedAccountId: connect.stripeAccountId,
        idempotencyKey,
        leaseId,
        propertyId: lease.propertyId,
        tenantUserId,
      });
    } catch (error) {
      if (!isPostgresUniqueViolation(error)) {
        throw error;
      }
      const existing = await tenantRentPaymentsDb.findByIdempotencyKey(idempotencyKey);
      if (!existing) {
        throw error;
      }
      if (existing.status === TenantRentPaymentStatus.PENDING && existing.stripeCheckoutSessionId) {
        const stripe = getStripeClient();
        const session = await stripe.checkout.sessions.retrieve(existing.stripeCheckoutSessionId);
        if (session.url && session.status === "open") {
          return { checkoutUrl: session.url, paymentId: existing.id };
        }
      }
      if (existing.status === TenantRentPaymentStatus.SUCCEEDED) {
        throw new RentPaymentValidationError("This rent payment was already completed");
      }
      payment = existing;
    }

    const stripe = getStripeClient();
    const appBase = tenantAppBaseUrl();
    const periodMonthsMeta = validated.allocations.map((a) => a.month).join(",");

    const session = await stripe.checkout.sessions.create(
      {
        cancel_url: `${appBase}/rent-payments/${payment.id}?status=cancel`,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                description: `Lease rent (${periodMonthsMeta})`,
                name: "Rent payment",
              },
              unit_amount: body.amountCents,
            },
            quantity: 1,
          },
        ],
        metadata: {
          amountCents: String(body.amountCents),
          leaseId,
          paymentId: payment.id,
          periodMonths: periodMonthsMeta,
          propertyId: lease.propertyId,
        },
        mode: "payment",
        payment_intent_data: {
          metadata: {
            leaseId,
            paymentId: payment.id,
            propertyId: lease.propertyId,
          },
          transfer_data: {
            destination: connect.stripeAccountId,
          },
        },
        success_url: `${appBase}/rent-payments/${payment.id}?status=success`,
      },
      { idempotencyKey }
    );

    if (!session.url) {
      throw new Error("Stripe Checkout Session did not return a URL");
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);

    await tenantRentPaymentsDb.updateStripeIds(payment.id, {
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
    });

    WinstonLogger.info({
      amountCents: body.amountCents,
      leaseId,
      msg: "tenant_payments.checkout_created",
      paymentId: payment.id,
      stripeCheckoutSessionId: session.id,
    });

    return { checkoutUrl: session.url, paymentId: payment.id };
  },

  async getBalance(leaseId: string, tenantUserId: string): Promise<ITenantLeaseBalanceResponse> {
    await assertLeaseTenantAccess(leaseId, tenantUserId);
    const lease = await propertyLongStaysDb.findById(leaseId);
    if (!lease) {
      throw new RentPaymentNotFoundError("Lease not found");
    }

    const [periods, connect] = await Promise.all([
      buildBalancePeriods(leaseId),
      propertyStripeAccountsDb.findByPropertyId(lease.propertyId),
    ]);
    const asOfMonth = transactionDateToMonth(getTodayUtcIsoDate());
    return {
      amountDueCents: sumAmountDueCents(periods, asOfMonth),
      currency: "usd",
      leaseId,
      paymentsEnabled: Boolean(connect?.chargesEnabled),
      periods,
    };
  },

  async getPaymentStatus(
    paymentId: string,
    tenantUserId: string
  ): Promise<ITenantRentPaymentStatusResponse> {
    const payment = await tenantRentPaymentsDb.findById(paymentId);
    if (!payment || payment.tenantUserId !== tenantUserId) {
      throw new RentPaymentNotFoundError();
    }
    await assertLeaseTenantAccess(payment.leaseId, tenantUserId);
    return toStatusResponse(payment);
  },

  async markCanceled(payment: ITenantRentPayment) {
    if (
      payment.status === TenantRentPaymentStatus.SUCCEEDED ||
      payment.status === TenantRentPaymentStatus.REFUNDED
    ) {
      return payment;
    }
    return tenantRentPaymentsDb.updateStatus(payment.id, TenantRentPaymentStatus.CANCELED);
  },

  async markFailed(payment: ITenantRentPayment) {
    if (
      payment.status === TenantRentPaymentStatus.SUCCEEDED ||
      payment.status === TenantRentPaymentStatus.REFUNDED
    ) {
      return payment;
    }
    return tenantRentPaymentsDb.updateStatus(payment.id, TenantRentPaymentStatus.FAILED);
  },

  async markSucceeded(payment: ITenantRentPayment, stripePaymentIntentId?: string | null) {
    let updated = payment;
    if (payment.status !== TenantRentPaymentStatus.SUCCEEDED) {
      const next = await tenantRentPaymentsDb.updateStatus(
        payment.id,
        TenantRentPaymentStatus.SUCCEEDED,
        { stripePaymentIntentId: stripePaymentIntentId ?? undefined }
      );
      if (!next) {
        throw new RentPaymentNotFoundError();
      }
      updated = next;
    } else if (stripePaymentIntentId && !payment.stripePaymentIntentId) {
      const next = await tenantRentPaymentsDb.updateStripeIds(payment.id, {
        stripePaymentIntentId,
      });
      if (next) updated = next;
    }
    await applyIncomeForFullyCoveredMonths(updated);
    return updated;
  },
};
