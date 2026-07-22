import { describe, expect, mock, test } from "bun:test";

import {
  stripeProcessingFeeAchSuccessFixture,
  stripeProcessingFeeCardSuccessFixture,
  stripeProcessingFeeWithApplicationFeeFixture,
} from "@/lib/fixtures/stripe-processing-fee-fixtures";
import {
  getStripeProcessingFeeCentsFromBalanceTransaction,
  getStripeProcessingFeeCentsFromCharge,
  getStripeProcessingFeeCentsFromPaymentIntent,
  sumStripeFeeCentsFromFeeDetails,
} from "@/lib/stripe-processing-fee";

describe("sumStripeFeeCentsFromFeeDetails", () => {
  test("sums only stripe_fee entries", () => {
    expect(
      sumStripeFeeCentsFromFeeDetails([
        { amount: 100, type: "stripe_fee" },
        { amount: 50, type: "stripe_fee" },
        { amount: 999, type: "application_fee" },
        { amount: 10, type: "tax" },
      ])
    ).toBe(150);
  });

  test("returns 0 for empty or missing details", () => {
    expect(sumStripeFeeCentsFromFeeDetails(undefined)).toBe(0);
    expect(sumStripeFeeCentsFromFeeDetails(null)).toBe(0);
    expect(sumStripeFeeCentsFromFeeDetails([])).toBe(0);
  });
});

describe("getStripeProcessingFeeCentsFromCharge fixtures", () => {
  test("card success → stripe_fee cents only", () => {
    expect(getStripeProcessingFeeCentsFromCharge(stripeProcessingFeeCardSuccessFixture)).toEqual({
      balanceTransactionId: "txn_card_success",
      feeCents: 466,
    });
  });

  test("ACH success → stripe_fee cents only", () => {
    expect(getStripeProcessingFeeCentsFromCharge(stripeProcessingFeeAchSuccessFixture)).toEqual({
      balanceTransactionId: "txn_ach_success",
      feeCents: 80,
    });
  });

  test("application_fee + stripe_fee → ignores application_fee", () => {
    expect(
      getStripeProcessingFeeCentsFromCharge(stripeProcessingFeeWithApplicationFeeFixture)
    ).toEqual({
      balanceTransactionId: "txn_card_with_app_fee",
      feeCents: 466,
    });
    expect(
      sumStripeFeeCentsFromFeeDetails(
        stripeProcessingFeeWithApplicationFeeFixture.balance_transaction.fee_details
      )
    ).toBe(466);
  });

  test("unexpanded balance_transaction id returns 0 fee until retrieved", () => {
    expect(getStripeProcessingFeeCentsFromBalanceTransaction("txn_unexpanded")).toEqual({
      balanceTransactionId: "txn_unexpanded",
      feeCents: 0,
    });
  });

  test("missing charge or balance transaction → 0", () => {
    expect(getStripeProcessingFeeCentsFromCharge(null)).toEqual({
      balanceTransactionId: null,
      feeCents: 0,
    });
    expect(getStripeProcessingFeeCentsFromCharge("ch_id_only")).toEqual({
      balanceTransactionId: null,
      feeCents: 0,
    });
  });
});

describe("getStripeProcessingFeeCentsFromPaymentIntent", () => {
  test("expands latest_charge.balance_transaction and returns stripe_fee cents", async () => {
    const retrieve = mock(() =>
      Promise.resolve({
        id: "pi_test",
        latest_charge: stripeProcessingFeeWithApplicationFeeFixture,
      })
    );

    const result = await getStripeProcessingFeeCentsFromPaymentIntent("pi_test", {
      stripe: {
        paymentIntents: { retrieve },
      } as never,
    });

    expect(retrieve).toHaveBeenCalledWith("pi_test", {
      expand: ["latest_charge.balance_transaction"],
    });
    expect(result).toEqual({
      balanceTransactionId: "txn_card_with_app_fee",
      feeCents: 466,
    });
  });
});
