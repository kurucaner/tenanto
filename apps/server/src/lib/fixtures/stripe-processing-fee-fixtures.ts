/**
 * Minimal Stripe balance-transaction / charge shapes for processing-fee fixtures.
 * Amounts are illustrative; tests assert stripe_fee summing and application_fee exclusion.
 */

export const stripeProcessingFeeCardSuccessFixture = {
  balance_transaction: {
    fee_details: [
      {
        amount: 466,
        application: null,
        currency: "usd",
        description: "Stripe processing fees",
        type: "stripe_fee",
      },
    ],
    id: "txn_card_success",
  },
  id: "ch_card_success",
} as const;

/** ACH Direct Debit success — lower processing fee, still type stripe_fee only. */
export const stripeProcessingFeeAchSuccessFixture = {
  balance_transaction: {
    fee_details: [
      {
        amount: 80,
        application: null,
        currency: "usd",
        description: "Stripe processing fees",
        type: "stripe_fee",
      },
    ],
    id: "txn_ach_success",
  },
  id: "ch_ach_success",
} as const;

/**
 * Card charge with platform application fee + Stripe processing fee.
 * Expense automation must book only the stripe_fee amount.
 */
export const stripeProcessingFeeWithApplicationFeeFixture = {
  balance_transaction: {
    fee_details: [
      {
        amount: 466,
        application: null,
        currency: "usd",
        description: "Stripe processing fees",
        type: "stripe_fee",
      },
      {
        amount: 4350,
        application: "ca_platform",
        currency: "usd",
        description: "Application fee",
        type: "application_fee",
      },
    ],
    id: "txn_card_with_app_fee",
  },
  id: "ch_card_with_app_fee",
} as const;
