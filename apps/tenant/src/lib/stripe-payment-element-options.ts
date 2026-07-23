import type { StripePaymentElementOptions } from "@stripe/stripe-js";

import { RentPaymentMethodFamily, type TRentPaymentMethodFamily } from "@/packages/shared";

/** Options for locked rent pay — method is chosen in-app; server excludes BNPL on the PI. */
export function buildStripePaymentElementOptions(
  paymentMethodFamily: TRentPaymentMethodFamily
): StripePaymentElementOptions {
  const paymentMethod =
    paymentMethodFamily === RentPaymentMethodFamily.CARD ? "card" : "us_bank_account";

  return {
    layout: {
      defaultCollapsed: false,
      type: "accordion",
      visibleAccordionItemsCount: 1,
    },
    paymentMethodOrder: [paymentMethod],
    wallets: {
      applePay: "never",
      googlePay: "never",
      link: "never",
    },
  };
}
