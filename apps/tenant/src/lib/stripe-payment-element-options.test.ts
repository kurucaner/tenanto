import { describe, expect, test } from "bun:test";

import { buildStripeElementsOptions } from "./stripe-elements-appearance";
import { buildStripePaymentElementOptions } from "./stripe-payment-element-options";
import { RentPaymentMethodFamily } from "@/packages/shared";

describe("buildStripeElementsOptions", () => {
  test("uses night theme when isDark is true", () => {
    const options = buildStripeElementsOptions({
      clientSecret: "pi_test_secret",
      isDark: true,
    });
    expect(options.clientSecret).toBe("pi_test_secret");
    expect(options.appearance?.theme).toBe("night");
  });

  test("uses stripe theme when isDark is false", () => {
    const options = buildStripeElementsOptions({
      clientSecret: "pi_test_secret",
      isDark: false,
    });
    expect(options.appearance?.theme).toBe("stripe");
  });
});

describe("buildStripePaymentElementOptions", () => {
  test("prefers card and hides wallets for card rent pay", () => {
    expect(buildStripePaymentElementOptions(RentPaymentMethodFamily.CARD)).toEqual({
      layout: {
        defaultCollapsed: false,
        type: "accordion",
        visibleAccordionItemsCount: 1,
      },
      paymentMethodOrder: ["card"],
      wallets: {
        applePay: "never",
        googlePay: "never",
        link: "never",
      },
    });
  });

  test("prefers ACH and hides wallets for bank rent pay", () => {
    expect(buildStripePaymentElementOptions(RentPaymentMethodFamily.US_BANK_ACCOUNT)).toEqual({
      layout: {
        defaultCollapsed: false,
        type: "accordion",
        visibleAccordionItemsCount: 1,
      },
      paymentMethodOrder: ["us_bank_account"],
      wallets: {
        applePay: "never",
        googlePay: "never",
        link: "never",
      },
    });
  });
});
