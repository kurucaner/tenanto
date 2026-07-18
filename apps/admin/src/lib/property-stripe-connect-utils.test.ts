import { describe, expect, test } from "bun:test";

import {
  expressOnboardingButtonLabel,
  getStripeConnectAccountTypeLabel,
  getStripeConnectUiStatus,
  shouldShowExpressOnboardingButton,
  shouldShowStandardDashboardLink,
  shouldShowStandardOAuthButton,
  showDualConnectOptions,
  standardOAuthButtonLabel,
  stripeConnectSectionDescription,
} from "@/lib/property-stripe-connect-utils";
import { PropertyStripeAccountType } from "@/packages/shared";

const baseStatus = {
  accountType: null as (typeof PropertyStripeAccountType)[keyof typeof PropertyStripeAccountType] | null,
  chargesEnabled: false,
  detailsSubmitted: false,
  onboardingComplete: false,
  payoutsEnabled: false,
  platformEnabled: true,
  standardOAuthEnabled: false,
  stripeAccountId: null as string | null,
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

  test("hidden when Express is connected", () => {
    expect(
      shouldShowStandardOAuthButton({
        ...baseStatus,
        accountType: PropertyStripeAccountType.EXPRESS,
        standardOAuthEnabled: true,
        stripeAccountId: "acct_express",
      })
    ).toBe(false);
  });

  test("shown when Standard OAuth enabled and not connected", () => {
    expect(shouldShowStandardOAuthButton({ ...baseStatus, standardOAuthEnabled: true })).toBe(
      true
    );
  });

  test("shown when Standard setup is incomplete", () => {
    expect(
      shouldShowStandardOAuthButton({
        ...baseStatus,
        accountType: PropertyStripeAccountType.STANDARD,
        standardOAuthEnabled: true,
        stripeAccountId: "acct_standard",
      })
    ).toBe(true);
  });

  test("hidden when Standard is ready", () => {
    expect(
      shouldShowStandardOAuthButton({
        ...baseStatus,
        accountType: PropertyStripeAccountType.STANDARD,
        chargesEnabled: true,
        standardOAuthEnabled: true,
        stripeAccountId: "acct_standard",
      })
    ).toBe(false);
  });
});

describe("showDualConnectOptions", () => {
  test("shows dual buttons when disconnected and Standard OAuth enabled", () => {
    expect(showDualConnectOptions({ ...baseStatus, standardOAuthEnabled: true })).toBe(true);
  });

  test("hides dual buttons when Standard OAuth disabled", () => {
    expect(showDualConnectOptions({ ...baseStatus })).toBe(false);
  });
});

describe("shouldShowStandardDashboardLink", () => {
  test("shows for ready Standard accounts", () => {
    expect(
      shouldShowStandardDashboardLink({
        ...baseStatus,
        accountType: PropertyStripeAccountType.STANDARD,
        chargesEnabled: true,
        stripeAccountId: "acct_standard",
      })
    ).toBe(true);
  });

  test("hides for Express accounts", () => {
    expect(
      shouldShowStandardDashboardLink({
        ...baseStatus,
        accountType: PropertyStripeAccountType.EXPRESS,
        chargesEnabled: true,
        stripeAccountId: "acct_express",
      })
    ).toBe(false);
  });
});

describe("onboarding copy", () => {
  test("uses Express button labels", () => {
    expect(expressOnboardingButtonLabel("not_connected")).toBe("Set up new Stripe account");
    expect(expressOnboardingButtonLabel("setup_incomplete")).toBe("Continue Stripe setup");
    expect(expressOnboardingButtonLabel("ready")).toBe("Update Stripe details");
  });

  test("uses Standard button labels", () => {
    expect(standardOAuthButtonLabel("not_connected")).toBe("Connect existing Stripe account");
    expect(standardOAuthButtonLabel("setup_incomplete")).toBe("Finish connecting Stripe account");
  });

  test("uses dual-option section description", () => {
    expect(
      stripeConnectSectionDescription({ ...baseStatus, standardOAuthEnabled: true }, "not_connected")
    ).toContain("Connect Stripe so tenants can pay rent");
  });

  test("uses Standard ready section description", () => {
    expect(
      stripeConnectSectionDescription(
        {
          ...baseStatus,
          accountType: PropertyStripeAccountType.STANDARD,
          chargesEnabled: true,
          stripeAccountId: "acct_standard",
        },
        "ready"
      )
    ).toContain("Connected to your existing Stripe account");
  });
});
