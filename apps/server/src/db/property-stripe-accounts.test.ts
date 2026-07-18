import { describe, expect, test } from "bun:test";

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
  test("returns null accountType when no account is linked", () => {
    expect(toConnectStatusResponse(null, true)).toEqual({
      accountType: null,
      chargesEnabled: false,
      detailsSubmitted: false,
      onboardingComplete: false,
      payoutsEnabled: false,
      platformEnabled: true,
      stripeAccountId: null,
    });
  });

  test("includes express accountType for linked Express accounts", () => {
    expect(toConnectStatusResponse(expressAccount, true)).toEqual({
      accountType: PropertyStripeAccountType.EXPRESS,
      chargesEnabled: true,
      detailsSubmitted: true,
      onboardingComplete: true,
      payoutsEnabled: true,
      platformEnabled: true,
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
});
