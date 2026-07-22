import { propertyExpenseCategoryTypesDb } from "@/db/property-expense-category-types";
import { propertyExpensesDb } from "@/db/property-expenses";
import { type ITenantRentPayment } from "@/db/tenant-rent-payments";
import { getTodayUtcIsoDate } from "@/lib/date-utils";
import { getStripeProcessingFeeCentsFromPaymentIntent } from "@/lib/stripe-processing-fee";
import { centsToDollars, type IPropertyExpense } from "@/packages/shared";
import { WinstonLogger } from "@/services/winston";
import type Stripe from "stripe";

const PROCESSING_FEE_EXPENSE_DESCRIPTION_PREFIX = "Stripe processing fee";

export function buildStripeProcessingFeeExpenseDescription(paymentId: string): string {
  return `${PROCESSING_FEE_EXPENSE_DESCRIPTION_PREFIX} (rent payment ${paymentId})`;
}

/**
 * After rent payment success: ensure Payment processing category, read Stripe
 * `stripe_fee` cents, and create an idempotent expense when fee > 0.
 * Returns the expense when created or already present; null when skipped.
 */
export async function bookStripeProcessingFeeExpenseForRentPayment(
  payment: Pick<ITenantRentPayment, "id" | "propertyId" | "stripePaymentIntentId">,
  options?: { expenseDate?: string; stripe?: Stripe }
): Promise<IPropertyExpense | null> {
  const paymentIntentId = payment.stripePaymentIntentId?.trim();
  if (!paymentIntentId) {
    return null;
  }

  const fee = await getStripeProcessingFeeCentsFromPaymentIntent(paymentIntentId, {
    stripe: options?.stripe,
  });

  if (fee.feeCents <= 0) {
    WinstonLogger.info({
      feeCents: fee.feeCents,
      msg: "tenant_payments.processing_fee_expense_skipped_zero",
      paymentId: payment.id,
      propertyId: payment.propertyId,
      stripePaymentIntentId: paymentIntentId,
    });
    return null;
  }

  if (fee.balanceTransactionId == null) {
    WinstonLogger.warn({
      feeCents: fee.feeCents,
      msg: "tenant_payments.processing_fee_expense_missing_balance_txn",
      paymentId: payment.id,
      propertyId: payment.propertyId,
      stripePaymentIntentId: paymentIntentId,
    });
    return null;
  }

  const category =
    await propertyExpenseCategoryTypesDb.ensureSystemPaymentProcessingExpenseCategory(
      payment.propertyId
    );

  const expense = await propertyExpensesDb.create(payment.propertyId, {
    amount: centsToDollars(fee.feeCents),
    cashExpense: false,
    categoryId: category.id,
    description: buildStripeProcessingFeeExpenseDescription(payment.id),
    expenseDate: options?.expenseDate ?? getTodayUtcIsoDate(),
    stripeBalanceTransactionId: fee.balanceTransactionId,
  });

  WinstonLogger.info({
    balanceTransactionId: fee.balanceTransactionId,
    expenseId: expense.id,
    feeCents: fee.feeCents,
    msg: "tenant_payments.processing_fee_expense_booked",
    paymentId: payment.id,
    propertyId: payment.propertyId,
  });

  return expense;
}
