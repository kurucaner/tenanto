import { describe, expect, test } from "bun:test";

import { getStripeConnectUiStatus } from "@/lib/property-stripe-connect-utils";

describe("getStripeConnectUiStatus", () => {
  test("not_connected when no account id", () => {
    expect(
      getStripeConnectUiStatus({
        chargesEnabled: false,
        detailsSubmitted: false,
        onboardingComplete: false,
        payoutsEnabled: false,
        platformEnabled: true,
        stripeAccountId: null,
      })
    ).toBe("not_connected");
  });

  test("ready when charges enabled", () => {
    expect(
      getStripeConnectUiStatus({
        chargesEnabled: true,
        detailsSubmitted: true,
        onboardingComplete: true,
        payoutsEnabled: true,
        platformEnabled: true,
        stripeAccountId: "acct_123",
      })
    ).toBe("ready");
  });

  test("setup_incomplete when account exists but charges disabled", () => {
    expect(
      getStripeConnectUiStatus({
        chargesEnabled: false,
        detailsSubmitted: true,
        onboardingComplete: false,
        payoutsEnabled: false,
        platformEnabled: true,
        stripeAccountId: "acct_123",
      })
    ).toBe("setup_incomplete");
  });
});
