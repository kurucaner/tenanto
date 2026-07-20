import { describe, expect, test } from "bun:test";

import {
  getStripeConnectOAuthErrorToast,
  parseStripeConnectOAuthErrorReason,
  parseStripeConnectReturnParam,
  resolveStripeConnectSettingsReturn,
  StripeConnectOAuthCallbackReason,
} from "@/lib/property-stripe-connect-return-utils";

describe("parseStripeConnectReturnParam", () => {
  test("accepts return, refresh, and error", () => {
    expect(parseStripeConnectReturnParam("return")).toBe("return");
    expect(parseStripeConnectReturnParam("refresh")).toBe("refresh");
    expect(parseStripeConnectReturnParam("error")).toBe("error");
  });

  test("returns null for unknown values", () => {
    expect(parseStripeConnectReturnParam("cancelled")).toBeNull();
    expect(parseStripeConnectReturnParam(null)).toBeNull();
  });
});

describe("parseStripeConnectOAuthErrorReason", () => {
  test("returns known reasons unchanged", () => {
    expect(parseStripeConnectOAuthErrorReason("denied")).toBe(
      StripeConnectOAuthCallbackReason.DENIED
    );
    expect(parseStripeConnectOAuthErrorReason("invalid_state")).toBe(
      StripeConnectOAuthCallbackReason.INVALID_STATE
    );
  });

  test("falls back to stripe_error for unknown or missing reasons", () => {
    expect(parseStripeConnectOAuthErrorReason("unexpected")).toBe(
      StripeConnectOAuthCallbackReason.STRIPE_ERROR
    );
    expect(parseStripeConnectOAuthErrorReason(null)).toBe(
      StripeConnectOAuthCallbackReason.STRIPE_ERROR
    );
  });
});

describe("getStripeConnectOAuthErrorToast", () => {
  test("returns user-facing copy for denied OAuth", () => {
    expect(getStripeConnectOAuthErrorToast(StripeConnectOAuthCallbackReason.DENIED)).toEqual({
      description: "You can connect Stripe again from property settings when you're ready.",
      title: "Stripe connection cancelled",
    });
  });

  test("returns user-facing copy for express conflict", () => {
    expect(
      getStripeConnectOAuthErrorToast(StripeConnectOAuthCallbackReason.EXPRESS_CONNECTED)
    ).toMatchObject({
      title: "Property already uses Stripe Express",
    });
  });
});

describe("resolveStripeConnectSettingsReturn", () => {
  test("returns success toast for return", () => {
    expect(
      resolveStripeConnectSettingsReturn({
        reason: null,
        stripeConnect: "return",
      })
    ).toEqual({
      toast: {
        description: "Refreshing account status from Stripe.",
        title: "Stripe Connect updated",
        type: "success",
      },
    });
  });

  test("returns message toast for refresh", () => {
    expect(
      resolveStripeConnectSettingsReturn({
        reason: null,
        stripeConnect: "refresh",
      })
    ).toEqual({
      toast: {
        description: "Continue setup when you're ready.",
        title: "Stripe onboarding incomplete",
        type: "message",
      },
    });
  });

  test("returns error toast for OAuth failures", () => {
    expect(
      resolveStripeConnectSettingsReturn({
        reason: StripeConnectOAuthCallbackReason.INVALID_STATE,
        stripeConnect: "error",
      })
    ).toEqual({
      toast: {
        description: "Start connecting Stripe again from property settings.",
        title: "Stripe connection session expired",
        type: "error",
      },
    });
  });

  test("returns null when stripe_connect is absent", () => {
    expect(
      resolveStripeConnectSettingsReturn({
        reason: null,
        stripeConnect: null,
      })
    ).toBeNull();
  });
});
