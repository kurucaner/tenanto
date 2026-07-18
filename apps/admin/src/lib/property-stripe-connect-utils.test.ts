import { describe, expect, test } from "bun:test";

import {
  expressConnectDescription,
  expressOnboardingButtonLabel,
  getStripeConnectAccountTypeLabel,
  getStripeConnectUiStatus,
  shouldShowExpressOnboardingButton,
  shouldShowStandardOAuthButton,
} from "@/lib/property-stripe-connect-utils";
import { PropertyStripeAccountType } from "@/packages/shared";

const baseStatus = {
  chargesEnabled: false,
  detailsSubmitted: false,
  onboardingComplete: false,
  payoutsEnabled: false,
  platformEnabled: true,
  standardOAuthEnabled: false,
  stripeAccountId: null as string | null,
  accountType: null as (typeof PropertyStripeAccountType)[keyof typeof PropertyStripeAccountType] | null,
};

describe("getStripeConnectUiStatus", () => {
  test("not_connected when no account id", () => {
    expect(getStripeConnectUiStatus({ ...baseStatus })).toBe("not_connected");
  });

  test("ready when charges enabled", () => {
    expect(
      getStripeConnectUiStatus({
        ...baseStatus,
        accountType: PropertyStripeAccountType.EXPRESS,
        chargesEnabled: true,
        detailsSubmitted: true,
        onboardingComplete: true,
        payoutsEnabled: true,
        stripeAccountId: "acct_123",
      })
    ).toBe("ready");
  });

  test("setup_incomplete when account exists but charges disabled", () => {
    expect(
      getStripeConnectUiStatus({
        ...baseStatus,
        accountType: PropertyStripeAccountType.EXPRESS,
        detailsSubmitted: true,
        stripeAccountId: "acct_123",
      })
    ).toBe("setup_incomplete");
  });
});

describe("getStripeConnectAccountTypeLabel", () => {
  test("returns Express or Standard labels when connected", () => {
    expect(getStripeConnectAccountTypeLabel(PropertyStripeAccountType.EXPRESS)).toBe("Express");
    expect(getStripeConnectAccountTypeLabel(PropertyStripeAccountType.STANDARD)).toBe("Standard");
    expect(getStripeConnectAccountTypeLabel(null)).toBeNull();
  });
});

describe("shouldShowExpressOnboardingButton", () => {
  test("shows when not connected", () => {
    expect(shouldShowExpressOnboardingButton({ ...baseStatus })).toBe(true);
  });

  test("shows for Express accounts", () => {
    expect(
      shouldShowExpressOnboardingButton({
        ...baseStatus,
        accountType: PropertyStripeAccountType.EXPRESS,
        stripeAccountId: "acct_express",
      })
    ).toBe(true);
  });

  test("hides for Standard accounts", () => {
    expect(
      shouldShowExpressOnboardingButton({
        ...baseStatus,
        accountType: PropertyStripeAccountType.STANDARD,
        stripeAccountId: "acct_standard",
      })
    ).toBe(false);
  });
});

describe("shouldShowStandardOAuthButton", () => {
  test("hidden when Standard OAuth is disabled", () => {
    expect(shouldShowStandardOAuthButton({ ...baseStatus, standardOAuthEnabled: false })).toBe(
      false
    );
  });

  test("hidden when already connected", () => {
    expect(
      shouldShowStandardOAuthButton({
        ...baseStatus,
        standardOAuthEnabled: true,
        stripeAccountId: "acct_1",
      })
    ).toBe(false);
  });

  test("shown when Standard OAuth enabled and not connected", () => {
    expect(
      shouldShowStandardOAuthButton({ ...baseStatus, standardOAuthEnabled: true })
    ).toBe(true);
  });
});

describe("express onboarding copy", () => {
  test("uses Phase 3a Express button labels", () => {
    expect(expressOnboardingButtonLabel("not_connected")).toBe("Set up new Stripe account");
    expect(expressOnboardingButtonLabel("setup_incomplete")).toBe("Continue Stripe setup");
    expect(expressOnboardingButtonLabel("ready")).toBe("Update Stripe details");
  });

  test("uses helper description when not connected", () => {
    expect(expressConnectDescription("not_connected")).toContain("don't have Stripe yet");
  });
});
