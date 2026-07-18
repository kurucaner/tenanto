import { describe, expect, test } from "bun:test";

import {
  buildPropertyStripeConnectSettingsRedirectUrl,
  mapStripeOAuthCallbackErrorReason,
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

  test("maps other Stripe errors to stripe_error", () => {
    expect(mapStripeOAuthCallbackErrorReason("invalid_scope")).toBe(
      StripeConnectOAuthCallbackReason.STRIPE_ERROR
    );
  });
});
