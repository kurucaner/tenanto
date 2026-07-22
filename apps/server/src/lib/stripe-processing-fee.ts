import type Stripe from "stripe";

import { getStripeClient } from "@/stripe/stripe-client";

export interface IStripeProcessingFeeResult {
  balanceTransactionId: string | null;
  /** Sum of `fee_details` amounts where `type === "stripe_fee"` (cents). Never includes `application_fee`. */
  feeCents: number;
}

type TFeeDetailLike = {
  amount: number;
  type: string;
};

type TBalanceTransactionLike = {
  fee_details?: ReadonlyArray<TFeeDetailLike> | null;
  id: string;
};

type TChargeLike = {
  balance_transaction?: TBalanceTransactionLike | string | null;
  id?: string;
};

const EMPTY_FEE: IStripeProcessingFeeResult = {
  balanceTransactionId: null,
  feeCents: 0,
};

/**
 * Sum only Stripe processing fees from balance-transaction `fee_details`.
 * Explicitly ignores `application_fee` and any other fee detail types.
 */
export function sumStripeFeeCentsFromFeeDetails(
  feeDetails: ReadonlyArray<TFeeDetailLike> | null | undefined
): number {
  if (feeDetails == null || feeDetails.length === 0) {
    return 0;
  }

  let total = 0;
  for (const detail of feeDetails) {
    if (detail.type === "stripe_fee" && Number.isFinite(detail.amount) && detail.amount > 0) {
      total += detail.amount;
    }
  }
  return total;
}

/**
 * Fee credits on refund balance transactions appear as negative `stripe_fee` amounts.
 * Returns absolute cents reversed (0 when Stripe keeps the original processing fee).
 */
export function sumReversedStripeFeeCentsFromFeeDetails(
  feeDetails: ReadonlyArray<TFeeDetailLike> | null | undefined
): number {
  if (feeDetails == null || feeDetails.length === 0) {
    return 0;
  }

  let total = 0;
  for (const detail of feeDetails) {
    if (detail.type === "stripe_fee" && Number.isFinite(detail.amount) && detail.amount < 0) {
      total += Math.abs(detail.amount);
    }
  }
  return total;
}

export function getStripeProcessingFeeCentsFromBalanceTransaction(
  balanceTransaction: TBalanceTransactionLike | string | null | undefined
): IStripeProcessingFeeResult {
  if (balanceTransaction == null) {
    return EMPTY_FEE;
  }
  if (typeof balanceTransaction === "string") {
    return { balanceTransactionId: balanceTransaction, feeCents: 0 };
  }

  return {
    balanceTransactionId: balanceTransaction.id,
    feeCents: sumStripeFeeCentsFromFeeDetails(balanceTransaction.fee_details),
  };
}

export function getStripeProcessingFeeCentsFromCharge(
  charge: TChargeLike | string | null | undefined
): IStripeProcessingFeeResult {
  if (charge == null || typeof charge === "string") {
    return EMPTY_FEE;
  }
  return getStripeProcessingFeeCentsFromBalanceTransaction(charge.balance_transaction);
}

/**
 * Retrieve a PaymentIntent with `latest_charge.balance_transaction` expanded and
 * return only Stripe processing fee cents (`stripe_fee`), never `application_fee`.
 */
export async function getStripeProcessingFeeCentsFromPaymentIntent(
  paymentIntentId: string,
  options?: { stripe?: Stripe }
): Promise<IStripeProcessingFeeResult> {
  const stripe = options?.stripe ?? getStripeClient();
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.balance_transaction"],
  });

  const charge = intent.latest_charge as TChargeLike | string | null | undefined;
  if (charge == null || typeof charge === "string") {
    return EMPTY_FEE;
  }

  const balanceTransaction = charge.balance_transaction;
  if (balanceTransaction == null) {
    return EMPTY_FEE;
  }

  if (typeof balanceTransaction === "string") {
    const retrieved = await stripe.balanceTransactions.retrieve(balanceTransaction);
    return getStripeProcessingFeeCentsFromBalanceTransaction(retrieved);
  }

  return getStripeProcessingFeeCentsFromBalanceTransaction(balanceTransaction);
}
