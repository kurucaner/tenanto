import { describe, expect, test } from "bun:test";

import { stripeConnectAccountFlagsFromStripeAccount } from "./stripe-connect-account-flags";

describe("stripeConnectAccountFlagsFromStripeAccount", () => {
  test("maps Stripe account capability flags", () => {
    expect(
      stripeConnectAccountFlagsFromStripeAccount({
        charges_enabled: true,
        details_submitted: true,
        payouts_enabled: false,
      })
    ).toEqual({
      chargesEnabled: true,
      detailsSubmitted: true,
      onboardingComplete: true,
      payoutsEnabled: false,
    });
  });

  test("treats missing flags as false", () => {
    expect(stripeConnectAccountFlagsFromStripeAccount({})).toEqual({
      chargesEnabled: false,
      detailsSubmitted: false,
      onboardingComplete: false,
      payoutsEnabled: false,
    });
  });
});
