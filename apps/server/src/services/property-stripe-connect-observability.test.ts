import { beforeEach, describe, expect, mock, test } from "bun:test";

import { StripeConnectOAuthCallbackReason } from "@/lib/stripe-connect-oauth-callback";
import { PropertyStripeAccountType } from "@/packages/shared";

const mockError = mock((_payload: Record<string, unknown>) => undefined);
const mockInfo = mock((_payload: Record<string, unknown>) => undefined);

mock.module("./winston", () => ({
  WinstonLogger: {
    error: mockError,
    info: mockInfo,
  },
}));

const {
  buildPropertyStripeConnectOAuthLogContext,
  logPropertyStripeConnectOAuthCompleted,
  logPropertyStripeConnectOAuthFailed,
  logPropertyStripeConnectOAuthStarted,
} = await import("./property-stripe-connect-observability");

describe("property-stripe-connect-observability", () => {
  beforeEach(() => {
    mockError.mockClear();
    mockInfo.mockClear();
  });

  test("builds stable OAuth log context", () => {
    expect(
      buildPropertyStripeConnectOAuthLogContext({
        accountType: PropertyStripeAccountType.STANDARD,
        propertyId: "property-1",
      })
    ).toEqual({
      accountType: PropertyStripeAccountType.STANDARD,
      propertyId: "property-1",
    });
  });

  test("emits connect_oauth_started without OAuth secrets", () => {
    logPropertyStripeConnectOAuthStarted({
      propertyId: "property-1",
      userId: "user-1",
    });

    expect(mockInfo).toHaveBeenCalledTimes(1);
    expect(mockInfo.mock.calls[0]?.[0]).toEqual({
      accountType: PropertyStripeAccountType.STANDARD,
      msg: "tenant_payments.connect_oauth_started",
      propertyId: "property-1",
      userId: "user-1",
    });
  });

  test("emits connect_oauth_completed with account identifiers only", () => {
    logPropertyStripeConnectOAuthCompleted({
      accountType: PropertyStripeAccountType.STANDARD,
      propertyId: "property-1",
      stripeAccountId: "acct_standard",
    });

    expect(mockInfo).toHaveBeenCalledTimes(1);
    expect(mockInfo.mock.calls[0]?.[0]).toEqual({
      accountType: PropertyStripeAccountType.STANDARD,
      msg: "tenant_payments.connect_oauth_completed",
      propertyId: "property-1",
      stripeAccountId: "acct_standard",
    });
  });

  test("emits connect_oauth_failed with reason and no OAuth secrets", () => {
    logPropertyStripeConnectOAuthFailed({
      accountType: PropertyStripeAccountType.STANDARD,
      propertyId: "property-1",
      reason: StripeConnectOAuthCallbackReason.DENIED,
    });

    expect(mockError).toHaveBeenCalledTimes(1);
    expect(mockError.mock.calls[0]?.[0]).toEqual({
      accountType: PropertyStripeAccountType.STANDARD,
      msg: "tenant_payments.connect_oauth_failed",
      propertyId: "property-1",
      reason: StripeConnectOAuthCallbackReason.DENIED,
    });
  });
});
