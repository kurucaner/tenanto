import { describe, expect, test } from "bun:test";

import {
  buildPropertyStripeConnectSettingsRedirectUrl,
  mapStandardOAuthFinishReason,
  mapStripeOAuthCallbackErrorReason,
  PROPERTY_STRIPE_ACCOUNTS_STRIPE_ACCOUNT_ID_UNIQ,
  StripeConnectOAuthCallbackReason,
} from "./stripe-connect-oauth-callback";

describe("buildPropertyStripeConnectSettingsRedirectUrl", () => {
  test("builds property settings return URL", () => {
    expect(
      buildPropertyStripeConnectSettingsRedirectUrl({
        platformAppUrl: "https://app.test",
        propertyId: "property-1",
        stripeConnect: "return",
      })
    ).toBe("https://app.test/properties/property-1/settings?stripe_connect=return");
  });

  test("builds property settings error URL with reason", () => {
    expect(
      buildPropertyStripeConnectSettingsRedirectUrl({
        platformAppUrl: "https://app.test/",
        propertyId: "property-1",
        reason: StripeConnectOAuthCallbackReason.INVALID_STATE,
        stripeConnect: "error",
      })
    ).toBe(
      "https://app.test/properties/property-1/settings?stripe_connect=error&reason=invalid_state"
    );
  });

  test("builds platform root error URL when propertyId is unknown", () => {
    expect(
      buildPropertyStripeConnectSettingsRedirectUrl({
        platformAppUrl: "https://app.test",
        reason: StripeConnectOAuthCallbackReason.NOT_CONFIGURED,
        stripeConnect: "error",
      })
    ).toBe("https://app.test/?stripe_connect=error&reason=not_configured");
  });
});

describe("mapStripeOAuthCallbackErrorReason", () => {
  test("maps access_denied to denied", () => {
    expect(mapStripeOAuthCallbackErrorReason("access_denied")).toBe(
      StripeConnectOAuthCallbackReason.DENIED
    );
  });

  test("maps invalid_scope to invalid_scope", () => {
    expect(mapStripeOAuthCallbackErrorReason("invalid_scope")).toBe(
      StripeConnectOAuthCallbackReason.INVALID_SCOPE
    );
  });

  test("maps unknown Stripe authorize errors to stripe_error", () => {
    expect(mapStripeOAuthCallbackErrorReason("server_error")).toBe(
      StripeConnectOAuthCallbackReason.STRIPE_ERROR
    );
  });
});

describe("mapStandardOAuthFinishReason", () => {
  test("maps invalid_grant to invalid_grant", () => {
    expect(mapStandardOAuthFinishReason({ code: "invalid_grant" })).toBe(
      StripeConnectOAuthCallbackReason.INVALID_GRANT
    );
  });

  test("maps stripe account unique violation to stripe_account_already_linked", () => {
    expect(
      mapStandardOAuthFinishReason({
        code: "23505",
        constraint: PROPERTY_STRIPE_ACCOUNTS_STRIPE_ACCOUNT_ID_UNIQ,
      })
    ).toBe(StripeConnectOAuthCallbackReason.STRIPE_ACCOUNT_ALREADY_LINKED);
  });

  test("maps other unique violations to token_exchange_failed", () => {
    expect(
      mapStandardOAuthFinishReason({
        code: "23505",
        constraint: "some_other_uniq",
      })
    ).toBe(StripeConnectOAuthCallbackReason.TOKEN_EXCHANGE_FAILED);
  });

  test("maps other failures to token_exchange_failed", () => {
    expect(mapStandardOAuthFinishReason({ code: "api_error" })).toBe(
      StripeConnectOAuthCallbackReason.TOKEN_EXCHANGE_FAILED
    );
    expect(mapStandardOAuthFinishReason(new Error("network"))).toBe(
      StripeConnectOAuthCallbackReason.TOKEN_EXCHANGE_FAILED
    );
  });
});
