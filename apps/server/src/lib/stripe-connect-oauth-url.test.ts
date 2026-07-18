import { describe, expect, test } from "bun:test";

import { buildStripeConnectStandardOAuthAuthorizeUrl } from "./stripe-connect-oauth-url";

describe("buildStripeConnectStandardOAuthAuthorizeUrl", () => {
  test("builds Stripe Connect OAuth authorize URL with required params", () => {
    const url = buildStripeConnectStandardOAuthAuthorizeUrl({
      clientId: "ca_test_client",
      redirectUri: "https://api.test/stripe/connect/oauth/callback",
      state: "signed-state-token",
    });

    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://connect.stripe.com/oauth/authorize");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("client_id")).toBe("ca_test_client");
    expect(parsed.searchParams.get("scope")).toBe("read_write");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "https://api.test/stripe/connect/oauth/callback"
    );
    expect(parsed.searchParams.get("state")).toBe("signed-state-token");
  });
});
