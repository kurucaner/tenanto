import { describe, expect, test } from "bun:test";

import {
  expressOnboardingButtonLabel,
  getStripeConnectAccountTypeLabel,
  getStripeConnectConnectedState,
  getStripeConnectUiStatus,
  isStripeConnectTypeSwitch,
  shouldShowExpressOnboardingButton,
  shouldShowStandardDashboardLink,
  shouldShowStandardOAuthButton,
  showDualConnectOptions,
  standardOAuthButtonLabel,
  stripeConnectSectionDescription,
} from "@/lib/property-stripe-connect-utils";
import { PropertyStripeAccountType } from "@/packages/shared";

const baseStatus = {
  accountType: null as
    (typeof PropertyStripeAccountType)[keyof typeof PropertyStripeAccountType] | null,
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

  test("shows for incomplete Standard accounts", () => {
    expect(
      shouldShowExpressOnboardingButton({
        ...baseStatus,
        accountType: PropertyStripeAccountType.STANDARD,
        stripeAccountId: "acct_standard",
      })
    ).toBe(true);
  });

  test("hides for ready Standard accounts", () => {
    expect(
      shouldShowExpressOnboardingButton({
        ...baseStatus,
        accountType: PropertyStripeAccountType.STANDARD,
        chargesEnabled: true,
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

  test("shown when incomplete Express setup can switch to Standard", () => {
    expect(
      shouldShowStandardOAuthButton({
        ...baseStatus,
        accountType: PropertyStripeAccountType.EXPRESS,
        standardOAuthEnabled: true,
        stripeAccountId: "acct_express",
      })
    ).toBe(true);
  });

  test("hidden when incomplete Express setup and Standard OAuth disabled", () => {
    expect(
      shouldShowStandardOAuthButton({
        ...baseStatus,
        accountType: PropertyStripeAccountType.EXPRESS,
        standardOAuthEnabled: false,
        stripeAccountId: "acct_express",
      })
    ).toBe(false);
  });

  test("hidden when ready Express is connected", () => {
    expect(
      shouldShowStandardOAuthButton({
        ...baseStatus,
        accountType: PropertyStripeAccountType.EXPRESS,
        chargesEnabled: true,
        standardOAuthEnabled: true,
        stripeAccountId: "acct_express",
      })
    ).toBe(false);
  });

  test("shown when Standard OAuth enabled and not connected", () => {
    expect(shouldShowStandardOAuthButton({ ...baseStatus, standardOAuthEnabled: true })).toBe(true);
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

  test("shown when Standard setup is incomplete even if OAuth flag is disabled", () => {
    expect(
      shouldShowStandardOAuthButton({
        ...baseStatus,
        accountType: PropertyStripeAccountType.STANDARD,
        standardOAuthEnabled: false,
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

  test("shows dual buttons when setup is incomplete and Standard OAuth enabled", () => {
    expect(
      showDualConnectOptions({
        ...baseStatus,
        accountType: PropertyStripeAccountType.EXPRESS,
        standardOAuthEnabled: true,
        stripeAccountId: "acct_express",
      })
    ).toBe(true);
  });

  test("hides dual buttons when Standard OAuth disabled", () => {
    expect(showDualConnectOptions({ ...baseStatus })).toBe(false);
  });

  test("hides dual buttons when setup is ready", () => {
    expect(
      showDualConnectOptions({
        ...baseStatus,
        accountType: PropertyStripeAccountType.EXPRESS,
        chargesEnabled: true,
        standardOAuthEnabled: true,
        stripeAccountId: "acct_express",
      })
    ).toBe(false);
  });
});

describe("isStripeConnectTypeSwitch", () => {
  test("returns true only for alternate type during incomplete setup", () => {
    const expressIncomplete = {
      ...baseStatus,
      accountType: PropertyStripeAccountType.EXPRESS,
      stripeAccountId: "acct_express",
    };
    const standardIncomplete = {
      ...baseStatus,
      accountType: PropertyStripeAccountType.STANDARD,
      stripeAccountId: "acct_standard",
    };

    expect(isStripeConnectTypeSwitch(expressIncomplete, "standard")).toBe(true);
    expect(isStripeConnectTypeSwitch(expressIncomplete, "express")).toBe(false);
    expect(isStripeConnectTypeSwitch(standardIncomplete, "express")).toBe(true);
    expect(isStripeConnectTypeSwitch(standardIncomplete, "standard")).toBe(false);
    expect(isStripeConnectTypeSwitch({ ...baseStatus }, "express")).toBe(false);
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

describe("getStripeConnectConnectedState", () => {
  test("returns null when not connected", () => {
    expect(getStripeConnectConnectedState({ ...baseStatus })).toBeNull();
  });

  test("returns all four connected states", () => {
    expect(
      getStripeConnectConnectedState({
        ...baseStatus,
        accountType: PropertyStripeAccountType.EXPRESS,
        stripeAccountId: "acct_express",
      })
    ).toBe("express_incomplete");

    expect(
      getStripeConnectConnectedState({
        ...baseStatus,
        accountType: PropertyStripeAccountType.EXPRESS,
        chargesEnabled: true,
        stripeAccountId: "acct_express",
      })
    ).toBe("express_ready");

    expect(
      getStripeConnectConnectedState({
        ...baseStatus,
        accountType: PropertyStripeAccountType.STANDARD,
        stripeAccountId: "acct_standard",
      })
    ).toBe("standard_incomplete");

    expect(
      getStripeConnectConnectedState({
        ...baseStatus,
        accountType: PropertyStripeAccountType.STANDARD,
        chargesEnabled: true,
        stripeAccountId: "acct_standard",
      })
    ).toBe("standard_ready");
  });
});

describe("connected-state actions", () => {
  test("Express incomplete shows dual onboarding options when Standard OAuth enabled", () => {
    const status = {
      ...baseStatus,
      accountType: PropertyStripeAccountType.EXPRESS,
      standardOAuthEnabled: true,
      stripeAccountId: "acct_express",
    };
    const uiStatus = getStripeConnectUiStatus(status);

    expect(getStripeConnectConnectedState(status)).toBe("express_incomplete");
    expect(showDualConnectOptions(status)).toBe(true);
    expect(shouldShowExpressOnboardingButton(status)).toBe(true);
    expect(shouldShowStandardOAuthButton(status)).toBe(true);
    expect(shouldShowStandardDashboardLink(status)).toBe(false);
    expect(expressOnboardingButtonLabel(uiStatus, status.accountType)).toBe("Continue Stripe setup");
    expect(standardOAuthButtonLabel(uiStatus, status.accountType)).toBe(
      "Connect existing Stripe account"
    );
  });

  test("Express ready shows update onboarding and hides Standard paths", () => {
    const status = {
      ...baseStatus,
      accountType: PropertyStripeAccountType.EXPRESS,
      chargesEnabled: true,
      stripeAccountId: "acct_express",
    };
    const uiStatus = getStripeConnectUiStatus(status);

    expect(getStripeConnectConnectedState(status)).toBe("express_ready");
    expect(shouldShowExpressOnboardingButton(status)).toBe(true);
    expect(shouldShowStandardOAuthButton(status)).toBe(false);
    expect(shouldShowStandardDashboardLink(status)).toBe(false);
    expect(expressOnboardingButtonLabel(uiStatus)).toBe("Update Stripe details");
  });

  test("Standard incomplete shows dual onboarding options when Standard OAuth enabled", () => {
    const status = {
      ...baseStatus,
      accountType: PropertyStripeAccountType.STANDARD,
      standardOAuthEnabled: true,
      stripeAccountId: "acct_standard",
    };
    const uiStatus = getStripeConnectUiStatus(status);

    expect(getStripeConnectConnectedState(status)).toBe("standard_incomplete");
    expect(showDualConnectOptions(status)).toBe(true);
    expect(shouldShowExpressOnboardingButton(status)).toBe(true);
    expect(shouldShowStandardOAuthButton(status)).toBe(true);
    expect(shouldShowStandardDashboardLink(status)).toBe(false);
    expect(expressOnboardingButtonLabel(uiStatus, status.accountType)).toBe(
      "Set up new Stripe account"
    );
    expect(standardOAuthButtonLabel(uiStatus, status.accountType)).toBe(
      "Finish connecting Stripe account"
    );
    expect(stripeConnectSectionDescription(status, uiStatus)).toContain("You’re almost ready");
  });

  test("Standard ready shows dashboard link and hides onboarding buttons", () => {
    const status = {
      ...baseStatus,
      accountType: PropertyStripeAccountType.STANDARD,
      chargesEnabled: true,
      stripeAccountId: "acct_standard",
    };
    const uiStatus = getStripeConnectUiStatus(status);

    expect(getStripeConnectConnectedState(status)).toBe("standard_ready");
    expect(shouldShowExpressOnboardingButton(status)).toBe(false);
    expect(shouldShowStandardOAuthButton(status)).toBe(false);
    expect(shouldShowStandardDashboardLink(status)).toBe(true);
    expect(stripeConnectSectionDescription(status, uiStatus)).toContain("Rent payments are live");
  });
});

describe("onboarding copy", () => {
  test("uses Express button labels", () => {
    expect(expressOnboardingButtonLabel("not_connected")).toBe("Set up with Stripe");
    expect(expressOnboardingButtonLabel("setup_incomplete")).toBe("Continue Stripe setup");
    expect(expressOnboardingButtonLabel("ready")).toBe("Update Stripe details");
  });

  test("uses Standard button labels", () => {
    expect(standardOAuthButtonLabel("not_connected")).toBe("Connect existing account");
    expect(standardOAuthButtonLabel("setup_incomplete")).toBe("Finish connecting Stripe account");
    expect(standardOAuthButtonLabel("setup_incomplete", PropertyStripeAccountType.EXPRESS)).toBe(
      "Connect existing Stripe account"
    );
  });

  test("uses Express switch label for incomplete Standard accounts", () => {
    expect(
      expressOnboardingButtonLabel("setup_incomplete", PropertyStripeAccountType.STANDARD)
    ).toBe("Set up new Stripe account");
  });

  test("uses not-connected section description", () => {
    expect(
      stripeConnectSectionDescription(
        { ...baseStatus, standardOAuthEnabled: true },
        "not_connected"
      )
    ).toContain("Let tenants pay rent online");
  });

  test("uses ready section description", () => {
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
    ).toContain("Rent payments are live");
  });
});
