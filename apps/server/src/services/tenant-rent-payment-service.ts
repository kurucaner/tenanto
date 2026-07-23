import { isPostgresUniqueViolation } from "@/db/pg-errors";
import { propertyIncomeLineTypesDb } from "@/db/property-income-line-types";
import { propertyIncomeLinesDb } from "@/db/property-income-lines";
import { propertyLongStaysDb } from "@/db/property-long-stays";
import { propertyStripeAccountsDb } from "@/db/property-stripe-accounts";
import { type ITenantRentPayment, tenantRentPaymentsDb } from "@/db/tenant-rent-payments";
import {
  rentPaymentConnectNotReadyError,
  rentPaymentNotFoundError,
  rentPaymentValidationError,
} from "@/errors/rent-payment-errors";
import { getTodayUtcIsoDate } from "@/lib/date-utils";
import {
  isStripeConnectEnabled,
  requireStripeConnectOperational,
} from "@/lib/stripe-connect-config";
import {
  buildRentCheckoutIdempotencyKey,
  calculateMiscIncomeLine,
  centsToDollars,
  computeRentCardConvenienceFeeCents,
  computeRentCheckoutChargeCents,
  computeTenantBalanceFromRentSchedule,
  isWeeklyPeriodKey,
  type ITenantCreateRentCheckoutBody,
  type ITenantCreateRentCheckoutResponse,
  type ITenantLeaseBalancePeriod,
  type ITenantLeaseBalanceResponse,
  type ITenantRentPaymentStatusResponse,
  type ITenantRentSummaryLease,
  type ITenantRentSummaryResponse,
  RentPaymentMethodFamily,
  TenantLeaseListStatus,
  TenantRentPaymentStatus,
  type TRentPaymentMethodFamily,
  validateCreateRentCheckoutBody,
} from "@/packages/shared";
import {
  bookAchReturnFeeExpenseForRentPayment,
  bookStripeProcessingFeeExpenseForRentPayment,
} from "@/services/book-stripe-processing-fee-expense";
import { assertLeaseTenantAccess } from "@/services/tenant-portal-access";
import { tenantPortalMembershipService } from "@/services/tenant-portal-membership-service";
import { WinstonLogger } from "@/services/winston";
import { getStripeClient, isStripeSecretConfigured } from "@/stripe/stripe-client";

export const TENANT_RENT_ACH_UNAVAILABLE_MESSAGE =
  "Bank transfer isn't available for this property yet. Please pay by card or contact your property manager.";

function tenantAppBaseUrl(): string {
  const base = process.env.TENANT_APP_URL?.trim().replace(/\/$/, "");
  if (!base) {
    throw new Error("TENANT_APP_URL is not configured");
  }
  return base;
}

function requireStripeConfigured(): void {
  requireStripeConnectOperational();
}

function resolveIncomeTransactionDateForPeriodKey(periodKey: string): string {
  return isWeeklyPeriodKey(periodKey) ? periodKey : `${periodKey}-01`;
}

async function loadTenantBalanceFromSchedule(leaseId: string) {
  const schedule = await propertyLongStaysDb.getRentSchedule(leaseId);
  return computeTenantBalanceFromRentSchedule(schedule, getTodayUtcIsoDate());
}

function isAchPaymentsCapabilityReady(status: string | undefined): boolean {
  return status === "active" || status === "pending";
}

async function readConnectAchPaymentsEnabled(stripeAccountId: string): Promise<boolean> {
  if (!isStripeConnectEnabled() || !isStripeSecretConfigured()) {
    return false;
  }
  try {
    const stripe = getStripeClient();
    const account = await stripe.accounts.retrieve(stripeAccountId);
    return isAchPaymentsCapabilityReady(account.capabilities?.us_bank_account_ach_payments);
  } catch (error) {
    WinstonLogger.warn({
      err: error,
      msg: "tenant_payments.ach_capability_read_failed",
      stripeAccountId,
    });
    return false;
  }
}

async function computeLeaseBalanceFields(
  leaseId: string,
  propertyId: string
): Promise<{
  achPaymentsEnabled: boolean;
  amountDueCents: number;
  duePeriodKeys: string[];
  paymentsEnabled: boolean;
  periods: ITenantLeaseBalancePeriod[];
}> {
  const [balance, connect] = await Promise.all([
    loadTenantBalanceFromSchedule(leaseId),
    propertyStripeAccountsDb.findByPropertyId(propertyId),
  ]);
  const paymentsEnabled = isStripeConnectEnabled() && Boolean(connect?.chargesEnabled);
  const achPaymentsEnabled =
    paymentsEnabled && connect
      ? await readConnectAchPaymentsEnabled(connect.stripeAccountId)
      : false;
  return {
    achPaymentsEnabled,
    amountDueCents: balance.amountDueCents,
    duePeriodKeys: balance.periodMonths,
    paymentsEnabled,
    periods: balance.periods,
  };
}

function stripeCheckoutPaymentMethodTypes(
  paymentMethodFamily: TRentPaymentMethodFamily
): Array<"card" | "us_bank_account"> {
  return paymentMethodFamily === RentPaymentMethodFamily.CARD ? ["card"] : ["us_bank_account"];
}

function computeRentCheckoutFeeCents(
  rentCents: number,
  paymentMethodFamily: TRentPaymentMethodFamily
): number {
  return paymentMethodFamily === RentPaymentMethodFamily.CARD
    ? computeRentCardConvenienceFeeCents(rentCents)
    : 0;
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
 * Book Long-term rent income for each positive allocation on a succeeded Stripe
 * rent payment. Amount is this payment's `allocatedCents` (supports partial Record
 * Rent + Stripe remainder). Idempotent per payment + rent period — does not skip
 * merely because another income line or schedule `isPaid` already exists.
 */
export async function applyIncomeForFullyCoveredMonths(payment: ITenantRentPayment): Promise<void> {
  const allocations = await tenantRentPaymentsDb.listAllocations(payment.id);
  if (allocations.length === 0) return;

  const lease = await propertyLongStaysDb.findById(payment.leaseId);
  if (!lease) {
    throw new Error(`Lease ${payment.leaseId} not found while applying rent payment`);
  }

  const existingForPayment = await propertyIncomeLinesDb.listActiveByTenantRentPaymentId(
    payment.id
  );
  const periodsBookedForPayment = new Set(
    existingForPayment
      .map((line) => line.rentPeriodKey)
      .filter((key): key is string => key != null && key !== "")
  );

  // Stripe rent checkouts always create Long-term rent lines — never Security deposit.
  const systemType = await propertyIncomeLineTypesDb.ensureLeaseRentIncomeLineType(
    payment.propertyId
  );
  const incomeLineTypeId = systemType.id;

  for (const allocation of allocations) {
    if (allocation.allocatedCents <= 0) {
      continue;
    }
    if (periodsBookedForPayment.has(allocation.periodMonth)) {
      continue;
    }

    const amountDollars = centsToDollars(allocation.allocatedCents);
    const computed = calculateMiscIncomeLine(amountDollars);
    await propertyIncomeLinesDb.create(
      payment.propertyId,
      {
        amount: amountDollars,
        description: `Tenant rent payment (${allocation.periodMonth})`,
        guestName: null,
        incomeLineTypeId,
        longStayId: payment.leaseId,
        rentPeriodKey: allocation.periodMonth,
        reservationId: null,
        tenantRentPaymentId: payment.id,
        transactionDate: resolveIncomeTransactionDateForPeriodKey(allocation.periodMonth),
        unitId: lease.unitId,
      },
      computed
    );
    periodsBookedForPayment.add(allocation.periodMonth);
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

    const lease = await propertyLongStaysDb.findById(leaseId);
    if (!lease) {
      throw rentPaymentNotFoundError("Lease not found");
    }

    const connect = await propertyStripeAccountsDb.findByPropertyId(lease.propertyId);
    if (!connect?.chargesEnabled) {
      throw rentPaymentConnectNotReadyError();
    }

    const balance = await loadTenantBalanceFromSchedule(leaseId);

    if (balance.amountDueCents <= 0 || balance.periodMonths.length === 0) {
      throw rentPaymentValidationError("Nothing is due right now");
    }

    const paymentMethodFamily = body.paymentMethodFamily;

    if (paymentMethodFamily === RentPaymentMethodFamily.US_BANK_ACCOUNT) {
      const achPaymentsEnabled = await readConnectAchPaymentsEnabled(connect.stripeAccountId);
      if (!achPaymentsEnabled) {
        throw rentPaymentValidationError(TENANT_RENT_ACH_UNAVAILABLE_MESSAGE);
      }
    }

    const validated = validateCreateRentCheckoutBody({
      amountCents: balance.amountDueCents,
      leaseId,
      paymentMethodFamily,
      periodMonths: balance.periodMonths,
      periods: balance.periods,
    });
    if (!validated.ok) {
      throw rentPaymentValidationError(validated.error);
    }

    const feeCents = computeRentCheckoutFeeCents(balance.amountDueCents, paymentMethodFamily);
    const chargeCents = computeRentCheckoutChargeCents(balance.amountDueCents, paymentMethodFamily);

    const idempotencyKey = buildRentCheckoutIdempotencyKey({
      amountCents: balance.amountDueCents,
      leaseId,
      paymentMethodFamily,
      periodMonths: balance.periodMonths,
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
        amountCents: balance.amountDueCents,
        chargeCents,
        connectedAccountId: connect.stripeAccountId,
        feeCents,
        idempotencyKey,
        leaseId,
        paymentMethodFamily,
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
        throw rentPaymentValidationError("This rent payment was already completed");
      }
      payment = existing;
    }

    const stripe = getStripeClient();
    const appBase = tenantAppBaseUrl();
    const periodMonthsMeta = validated.allocations.map((a) => a.month).join(",");

    const paymentIntentMetadata = {
      amountCents: String(balance.amountDueCents),
      chargeCents: String(chargeCents),
      feeCents: String(feeCents),
      leaseId,
      paymentId: payment.id,
      paymentMethodFamily,
      propertyId: lease.propertyId,
    };

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
              unit_amount: chargeCents,
            },
            quantity: 1,
          },
        ],
        metadata: {
          ...paymentIntentMetadata,
          periodMonths: periodMonthsMeta,
        },
        mode: "payment",
        payment_intent_data: {
          ...(feeCents > 0 ? { application_fee_amount: feeCents } : {}),
          metadata: paymentIntentMetadata,
          transfer_data: {
            destination: connect.stripeAccountId,
          },
        },
        payment_method_types: stripeCheckoutPaymentMethodTypes(paymentMethodFamily),
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
      amountCents: balance.amountDueCents,
      chargeCents,
      feeCents,
      leaseId,
      msg: "tenant_payments.checkout_created",
      paymentId: payment.id,
      paymentMethodFamily,
      stripeCheckoutSessionId: session.id,
    });

    return { checkoutUrl: session.url, paymentId: payment.id };
  },

  async getBalance(leaseId: string, tenantUserId: string): Promise<ITenantLeaseBalanceResponse> {
    await assertLeaseTenantAccess(leaseId, tenantUserId);
    const lease = await propertyLongStaysDb.findById(leaseId);
    if (!lease) {
      throw rentPaymentNotFoundError("Lease not found");
    }

    const { achPaymentsEnabled, amountDueCents, paymentsEnabled, periods } =
      await computeLeaseBalanceFields(leaseId, lease.propertyId);
    return {
      achPaymentsEnabled,
      amountDueCents,
      currency: "usd",
      leaseId,
      paymentsEnabled,
      periods,
    };
  },

  async getPaymentStatus(
    paymentId: string,
    tenantUserId: string
  ): Promise<ITenantRentPaymentStatusResponse> {
    const payment = await tenantRentPaymentsDb.findById(paymentId);
    if (!payment || payment.tenantUserId !== tenantUserId) {
      throw rentPaymentNotFoundError();
    }
    await assertLeaseTenantAccess(payment.leaseId, tenantUserId);
    return toStatusResponse(payment);
  },

  async getRentSummary(tenantUserId: string): Promise<ITenantRentSummaryResponse> {
    const [activeLeases, endedLeases] = await Promise.all([
      tenantPortalMembershipService.listLeases(tenantUserId, TenantLeaseListStatus.ACTIVE),
      tenantPortalMembershipService.listLeases(tenantUserId, TenantLeaseListStatus.ENDED),
    ]);

    const leases: ITenantRentSummaryLease[] = await Promise.all(
      activeLeases.map(async (item) => {
        const lease = await propertyLongStaysDb.findById(item.leaseId);
        if (!lease) {
          return {
            amountDueCents: 0,
            duePeriodKeys: [],
            leaseId: item.leaseId,
            paymentsEnabled: false,
            propertyName: item.propertyName,
            unitLabel: item.unitLabel,
          };
        }
        const { amountDueCents, duePeriodKeys, paymentsEnabled } = await computeLeaseBalanceFields(
          item.leaseId,
          lease.propertyId
        );
        return {
          amountDueCents,
          duePeriodKeys,
          leaseId: item.leaseId,
          paymentsEnabled,
          propertyName: item.propertyName,
          unitLabel: item.unitLabel,
        };
      })
    );

    const totalAmountDueCents = leases.reduce((sum, row) => sum + row.amountDueCents, 0);
    return {
      currency: "usd",
      hasActiveLease: activeLeases.length > 0,
      hasPastLeases: endedLeases.length > 0,
      leases,
      totalAmountDueCents,
    };
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
    const updated = await tenantRentPaymentsDb.updateStatus(
      payment.id,
      TenantRentPaymentStatus.FAILED
    );
    const target = updated ?? payment;
    try {
      await bookAchReturnFeeExpenseForRentPayment(target);
    } catch (error) {
      WinstonLogger.error({
        err: error,
        msg: "tenant_payments.ach_return_fee_expense_failed",
        paymentId: target.id,
        propertyId: target.propertyId,
        stripePaymentIntentId: target.stripePaymentIntentId,
      });
    }
    return updated;
  },

  async markProcessing(payment: ITenantRentPayment, stripePaymentIntentId?: string | null) {
    if (
      payment.status === TenantRentPaymentStatus.SUCCEEDED ||
      payment.status === TenantRentPaymentStatus.REFUNDED ||
      payment.status === TenantRentPaymentStatus.CANCELED ||
      payment.status === TenantRentPaymentStatus.FAILED
    ) {
      return payment;
    }
    if (payment.status === TenantRentPaymentStatus.PROCESSING) {
      if (stripePaymentIntentId && !payment.stripePaymentIntentId) {
        const next = await tenantRentPaymentsDb.updateStripeIds(payment.id, {
          stripePaymentIntentId,
        });
        if (next) {
          return next;
        }
      }
      return payment;
    }
    return tenantRentPaymentsDb.updateStatus(payment.id, TenantRentPaymentStatus.PROCESSING, {
      stripePaymentIntentId: stripePaymentIntentId ?? undefined,
    });
  },

  async markRefunded(
    payment: ITenantRentPayment,
    charge?: { amountRefundedCents: number; chargeAmountCents: number }
  ) {
    if (payment.status === TenantRentPaymentStatus.REFUNDED) {
      return payment;
    }

    const isFullRefund =
      charge === undefined || charge.amountRefundedCents >= charge.chargeAmountCents;

    if (charge && !isFullRefund) {
      WinstonLogger.warn({
        amountRefundedCents: charge.amountRefundedCents,
        chargeAmountCents: charge.chargeAmountCents,
        msg: "tenant_payments.refund_partial_unhandled",
        paymentId: payment.id,
      });
    }

    const updated = await tenantRentPaymentsDb.updateStatus(
      payment.id,
      TenantRentPaymentStatus.REFUNDED
    );
    if (!updated) {
      throw rentPaymentNotFoundError();
    }

    if (isFullRefund) {
      const refundedLineCount = await propertyIncomeLinesDb.refundAllLinkedToTenantRentPayment(
        payment.id
      );
      WinstonLogger.info({
        msg: "tenant_payments.refunded",
        paymentId: payment.id,
        refundedIncomeLineCount: refundedLineCount,
      });
    }

    return updated;
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
        throw rentPaymentNotFoundError();
      }
      updated = next;
    } else if (stripePaymentIntentId && !payment.stripePaymentIntentId) {
      const next = await tenantRentPaymentsDb.updateStripeIds(payment.id, {
        stripePaymentIntentId,
      });
      if (next) updated = next;
    }
    await applyIncomeForFullyCoveredMonths(updated);
    try {
      await bookStripeProcessingFeeExpenseForRentPayment(updated);
    } catch (error) {
      WinstonLogger.error({
        err: error,
        msg: "tenant_payments.processing_fee_expense_failed",
        paymentId: updated.id,
        propertyId: updated.propertyId,
        stripePaymentIntentId: updated.stripePaymentIntentId,
      });
    }
    return updated;
  },
};
