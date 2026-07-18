import { afterEach, describe, expect, test } from "bun:test";

import { PropertyStripeAccountType } from "@/packages/shared";

import { type IPropertyStripeAccount, toConnectStatusResponse } from "./property-stripe-accounts";

const expressAccount: IPropertyStripeAccount = {
  accountType: PropertyStripeAccountType.EXPRESS,
  chargesEnabled: true,
  detailsSubmitted: true,
  onboardingComplete: true,
  payoutsEnabled: true,
  propertyId: "property-1",
  stripeAccountId: "acct_express",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("toConnectStatusResponse", () => {
  const originalConnectFlag = process.env.STRIPE_CONNECT_ENABLED;
  const originalStandardOAuthFlag = process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED;
  const originalClientId = process.env.STRIPE_CONNECT_CLIENT_ID;

  afterEach(() => {
    if (originalConnectFlag === undefined) {
      delete process.env.STRIPE_CONNECT_ENABLED;
    } else {
      process.env.STRIPE_CONNECT_ENABLED = originalConnectFlag;
    }
    if (originalStandardOAuthFlag === undefined) {
      delete process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED;
    } else {
      process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED = originalStandardOAuthFlag;
    }
    if (originalClientId === undefined) {
      delete process.env.STRIPE_CONNECT_CLIENT_ID;
    } else {
      process.env.STRIPE_CONNECT_CLIENT_ID = originalClientId;
    }
  });

  test("returns null accountType when no account is linked", () => {
    delete process.env.STRIPE_CONNECT_ENABLED;
    expect(toConnectStatusResponse(null, true)).toEqual({
      accountType: null,
      chargesEnabled: false,
      detailsSubmitted: false,
      onboardingComplete: false,
      payoutsEnabled: false,
      platformEnabled: true,
      standardOAuthEnabled: false,
      stripeAccountId: null,
    });
  });

  test("includes express accountType for linked Express accounts", () => {
    delete process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED;
    expect(toConnectStatusResponse(expressAccount, true)).toEqual({
      accountType: PropertyStripeAccountType.EXPRESS,
      chargesEnabled: true,
      detailsSubmitted: true,
      onboardingComplete: true,
      payoutsEnabled: true,
      platformEnabled: true,
      standardOAuthEnabled: false,
      stripeAccountId: "acct_express",
    });
  });

  test("includes standard accountType for linked Standard accounts", () => {
    expect(
      toConnectStatusResponse(
        {
          ...expressAccount,
          accountType: PropertyStripeAccountType.STANDARD,
          stripeAccountId: "acct_standard",
        },
        true
      )
    ).toMatchObject({
      accountType: PropertyStripeAccountType.STANDARD,
      stripeAccountId: "acct_standard",
    });
  });

  test("includes standardOAuthEnabled when Standard OAuth env is configured", () => {
    process.env.STRIPE_CONNECT_ENABLED = "true";
    process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED = "true";
    process.env.STRIPE_CONNECT_CLIENT_ID = "ca_test_client";

    expect(toConnectStatusResponse(null, true).standardOAuthEnabled).toBe(true);
  });
});
