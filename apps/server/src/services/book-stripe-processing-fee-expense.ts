import type Stripe from "stripe";

import { propertyExpenseCategoryTypesDb } from "@/db/property-expense-category-types";
import { propertyExpensesDb } from "@/db/property-expenses";
import { type ITenantRentPayment } from "@/db/tenant-rent-payments";
import { getTodayUtcIsoDate } from "@/lib/date-utils";
import {
  getStripeProcessingFeeCentsFromBalanceTransaction,
  getStripeProcessingFeeCentsFromCharge,
  getStripeProcessingFeeCentsFromPaymentIntent,
  type IStripeProcessingFeeResult,
  sumReversedStripeFeeCentsFromFeeDetails,
} from "@/lib/stripe-processing-fee";
import { centsToDollars, type IPropertyExpense } from "@/packages/shared";
import { WinstonLogger } from "@/services/winston";
import { getStripeClient } from "@/stripe/stripe-client";

const PROCESSING_FEE_EXPENSE_DESCRIPTION_PREFIX = "Stripe processing fee";
const ACH_RETURN_FEE_EXPENSE_DESCRIPTION_PREFIX = "ACH return fee";

type TRentPaymentFeeTarget = Pick<
  ITenantRentPayment,
  "id" | "propertyId" | "stripePaymentIntentId"
>;

export function buildStripeProcessingFeeExpenseDescription(paymentId: string): string {
  return `${PROCESSING_FEE_EXPENSE_DESCRIPTION_PREFIX} (rent payment ${paymentId})`;
}

export function buildAchReturnFeeExpenseDescription(paymentId: string): string {
  return `${ACH_RETURN_FEE_EXPENSE_DESCRIPTION_PREFIX} (rent payment ${paymentId})`;
}

async function bookStripeFeeExpense(input: {
  description: string;
  expenseDate?: string;
  fee: IStripeProcessingFeeResult;
  logPrefix: "processing_fee" | "ach_return_fee";
  payment: TRentPaymentFeeTarget;
}): Promise<IPropertyExpense | null> {
  const { description, fee, logPrefix, payment } = input;

  if (fee.feeCents <= 0) {
    WinstonLogger.info({
      balanceTxnId: fee.balanceTransactionId,
      feeCents: fee.feeCents,
      msg: `tenant_payments.${logPrefix}_expense_skipped_zero`,
      paymentId: payment.id,
      propertyId: payment.propertyId,
      stripePaymentIntentId: payment.stripePaymentIntentId,
    });
    return null;
  }

  if (fee.balanceTransactionId == null) {
    WinstonLogger.warn({
      balanceTxnId: null,
      feeCents: fee.feeCents,
      msg: `tenant_payments.${logPrefix}_expense_missing_balance_txn`,
      paymentId: payment.id,
      propertyId: payment.propertyId,
      stripePaymentIntentId: payment.stripePaymentIntentId,
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
    description,
    expenseDate: input.expenseDate ?? getTodayUtcIsoDate(),
    stripeBalanceTransactionId: fee.balanceTransactionId,
  });

  WinstonLogger.info({
    balanceTxnId: fee.balanceTransactionId,
    expenseId: expense.id,
    feeCents: fee.feeCents,
    msg: `tenant_payments.${logPrefix}_expense_booked`,
    paymentId: payment.id,
    propertyId: payment.propertyId,
  });

  return expense;
}

async function resolveFeeFromCharge(
  charge: Parameters<typeof getStripeProcessingFeeCentsFromCharge>[0],
  stripe?: Stripe
): Promise<IStripeProcessingFeeResult> {
  const fromCharge = getStripeProcessingFeeCentsFromCharge(charge);
  if (fromCharge.feeCents > 0 || fromCharge.balanceTransactionId == null) {
    return fromCharge;
  }
  if (typeof charge === "string" || charge == null) {
    return fromCharge;
  }
  if (typeof charge.balance_transaction !== "string") {
    return fromCharge;
  }

  const client = stripe ?? getStripeClient();
  const retrieved = await client.balanceTransactions.retrieve(charge.balance_transaction);
  return getStripeProcessingFeeCentsFromBalanceTransaction(retrieved);
}

/**
 * After rent payment success: ensure Payment processing category, read Stripe
 * `stripe_fee` cents, and create an idempotent expense when fee > 0.
 * Returns the expense when created or already present; null when skipped.
 */
export async function bookStripeProcessingFeeExpenseForRentPayment(
  payment: TRentPaymentFeeTarget,
  options?: { expenseDate?: string; stripe?: Stripe }
): Promise<IPropertyExpense | null> {
  const paymentIntentId = payment.stripePaymentIntentId?.trim();
  if (!paymentIntentId) {
    return null;
  }

  const fee = await getStripeProcessingFeeCentsFromPaymentIntent(paymentIntentId, {
    stripe: options?.stripe,
  });

  return bookStripeFeeExpense({
    description: buildStripeProcessingFeeExpenseDescription(payment.id),
    expenseDate: options?.expenseDate,
    fee,
    logPrefix: "processing_fee",
    payment,
  });
}

/**
 * After ACH / payment failure: book Stripe `stripe_fee` under Payment processing
 * with an ACH return description. Prefer an expanded Charge when provided
 * (late return fees); otherwise retrieve from the PaymentIntent.
 */
export async function bookAchReturnFeeExpenseForRentPayment(
  payment: TRentPaymentFeeTarget,
  options?: {
    charge?: Parameters<typeof getStripeProcessingFeeCentsFromCharge>[0];
    expenseDate?: string;
    stripe?: Stripe;
  }
): Promise<IPropertyExpense | null> {
  let fee: IStripeProcessingFeeResult;

  if (options?.charge != null) {
    fee = await resolveFeeFromCharge(options.charge, options.stripe);
  } else {
    const paymentIntentId = payment.stripePaymentIntentId?.trim();
    if (!paymentIntentId) {
      return null;
    }
    fee = await getStripeProcessingFeeCentsFromPaymentIntent(paymentIntentId, {
      stripe: options?.stripe,
    });
  }

  return bookStripeFeeExpense({
    description: buildAchReturnFeeExpenseDescription(payment.id),
    expenseDate: options?.expenseDate,
    fee,
    logPrefix: "ach_return_fee",
    payment,
  });
}

export type TProcessingFeeRefundExpenseOutcome = "left_in_place" | "no_expense" | "soft_deleted";

function originalChargeBalanceTransactionId(charge: Stripe.Charge): string | null {
  const balanceTransaction = charge.balance_transaction;
  if (balanceTransaction == null) {
    return null;
  }
  if (typeof balanceTransaction === "string") {
    return balanceTransaction;
  }
  return balanceTransaction.id;
}

async function sumReversedProcessingFeeCentsFromChargeRefunds(
  charge: Stripe.Charge,
  stripe?: Stripe
): Promise<number> {
  const refunds = charge.refunds?.data ?? [];
  if (refunds.length === 0) {
    return 0;
  }

  const client = stripe ?? getStripeClient();
  let reversedCents = 0;

  for (const refund of refunds) {
    let balanceTransaction = refund.balance_transaction;
    if (balanceTransaction == null) {
      continue;
    }
    if (typeof balanceTransaction === "string") {
      balanceTransaction = await client.balanceTransactions.retrieve(balanceTransaction);
    }
    reversedCents += sumReversedStripeFeeCentsFromFeeDetails(balanceTransaction.fee_details);
  }

  return reversedCents;
}

/**
 * On rent charge refund: soft-delete the Payment processing expense only when
 * Stripe reverses `stripe_fee` on a refund balance transaction. Otherwise leave
 * the expense (Stripe normally keeps processing fees on refund).
 * Idempotent when the expense is already soft-deleted.
 */
export async function reverseProcessingFeeExpenseOnRentRefund(
  payment: TRentPaymentFeeTarget,
  charge: Stripe.Charge,
  options?: { stripe?: Stripe }
): Promise<TProcessingFeeRefundExpenseOutcome> {
  const reversedCents = await sumReversedProcessingFeeCentsFromChargeRefunds(
    charge,
    options?.stripe
  );

  if (reversedCents <= 0) {
    WinstonLogger.info({
      balanceTxnId: originalChargeBalanceTransactionId(charge),
      chargeId: charge.id,
      feeCents: 0,
      msg: "tenant_payments.processing_fee_expense_left_on_refund",
      paymentId: payment.id,
      propertyId: payment.propertyId,
      reason: "stripe_kept_processing_fee",
    });
    return "left_in_place";
  }

  const originalBalanceTransactionId = originalChargeBalanceTransactionId(charge);
  if (originalBalanceTransactionId == null) {
    WinstonLogger.warn({
      balanceTxnId: null,
      chargeId: charge.id,
      feeCents: reversedCents,
      msg: "tenant_payments.processing_fee_expense_refund_missing_original_bt",
      paymentId: payment.id,
      propertyId: payment.propertyId,
    });
    return "no_expense";
  }

  const expense = await propertyExpensesDb.findByStripeBalanceTransactionId(
    originalBalanceTransactionId
  );
  if (expense == null) {
    WinstonLogger.info({
      balanceTxnId: originalBalanceTransactionId,
      feeCents: reversedCents,
      msg: "tenant_payments.processing_fee_expense_refund_no_expense",
      paymentId: payment.id,
      propertyId: payment.propertyId,
    });
    return "no_expense";
  }

  if (expense.isDeleted) {
    return "soft_deleted";
  }

  await propertyExpensesDb.softDelete(expense.id);

  WinstonLogger.info({
    balanceTxnId: originalBalanceTransactionId,
    expenseId: expense.id,
    feeCents: reversedCents,
    msg: "tenant_payments.processing_fee_expense_soft_deleted_on_refund",
    paymentId: payment.id,
    propertyId: payment.propertyId,
  });

  return "soft_deleted";
}
