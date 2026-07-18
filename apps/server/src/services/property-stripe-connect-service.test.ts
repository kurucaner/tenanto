import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { IPropertyStripeAccount } from "@/db/property-stripe-accounts";
import { StripeConnectOAuthCallbackReason } from "@/lib/stripe-connect-oauth-callback";
import { PropertyStripeAccountType } from "@/packages/shared";
import { mockAsyncFn, mockResolved, mockResolvedNull } from "@/test-fixtures/mocks";

const mockFindByPropertyId = mockResolvedNull<IPropertyStripeAccount>();
const mockUpdateFlags = mockResolvedNull<IPropertyStripeAccount>();
const mockUpsert = mockResolvedNull<IPropertyStripeAccount>();
const mockAccountsCreate = mockAsyncFn(() =>
  Promise.resolve({
    charges_enabled: false,
    details_submitted: false,
    id: "acct_new",
    payouts_enabled: false,
  })
);
const mockAccountsRetrieve = mockAsyncFn(() =>
  Promise.resolve({
    charges_enabled: true,
    details_submitted: true,
    payouts_enabled: true,
  })
);
const mockAccountLinksCreate = mockResolved({ url: "https://stripe.test/onboard" });
const mockCreateOAuthState = mockAsyncFn(() => Promise.resolve("signed-oauth-state"));
const mockConsumeOAuthState = mockAsyncFn(() =>
  Promise.resolve({ propertyId: "property-1", userId: "user-1" })
);
const mockOauthToken = mockAsyncFn(() => Promise.resolve({ stripe_user_id: "acct_standard" }));

mock.module("@/lib/stripe-connect-oauth-state", () => ({
  consumeStripeConnectOAuthState: mockConsumeOAuthState,
  createStripeConnectOAuthState: mockCreateOAuthState,
}));

mock.module("@/db/property-stripe-accounts", () => ({
  propertyStripeAccountsDb: {
    findByPropertyId: mockFindByPropertyId,
    updateFlags: mockUpdateFlags,
    upsert: mockUpsert,
  },
  toConnectStatusResponse: (account: IPropertyStripeAccount | null, platformEnabled: boolean) => ({
    accountType: account?.accountType ?? null,
    chargesEnabled: account?.chargesEnabled ?? false,
    detailsSubmitted: account?.detailsSubmitted ?? false,
    onboardingComplete: account?.onboardingComplete ?? false,
    payoutsEnabled: account?.payoutsEnabled ?? false,
    platformEnabled,
    standardOAuthEnabled: false,
    stripeAccountId: account?.stripeAccountId ?? null,
  }),
}));

mock.module("@/stripe/stripe-client", () => ({
  getStripeClient: () => ({
    accountLinks: {
      create: mockAccountLinksCreate,
    },
    accounts: {
      create: mockAccountsCreate,
      retrieve: mockAccountsRetrieve,
    },
    oauth: {
      token: mockOauthToken,
    },
  }),
  isStripeSecretConfigured: () => true,
}));

const { propertyStripeConnectService } = await import("./property-stripe-connect-service");

describe("propertyStripeConnectService.createExpressOnboardingLink", () => {
  const originalFlag = process.env.STRIPE_CONNECT_ENABLED;
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  const originalPlatformUrl = process.env.PLATFORM_APP_URL;

  beforeEach(() => {
    process.env.STRIPE_CONNECT_ENABLED = "true";
    process.env.STRIPE_SECRET_KEY = "sk_test";
    process.env.PLATFORM_APP_URL = "https://app.test";
    mockFindByPropertyId.mockReset();
    mockUpsert.mockReset();
    mockAccountsCreate.mockReset();
    mockAccountLinksCreate.mockReset();
    mockFindByPropertyId.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({
      accountType: PropertyStripeAccountType.EXPRESS,
      chargesEnabled: false,
      detailsSubmitted: false,
      onboardingComplete: false,
      payoutsEnabled: false,
      propertyId: "property-1",
      stripeAccountId: "acct_new",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    mockAccountsCreate.mockResolvedValue({
      charges_enabled: false,
      details_submitted: false,
      id: "acct_new",
      payouts_enabled: false,
    });
    mockAccountLinksCreate.mockResolvedValue({ url: "https://stripe.test/onboard" });
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.STRIPE_CONNECT_ENABLED;
    } else {
      process.env.STRIPE_CONNECT_ENABLED = originalFlag;
    }
    if (originalSecret === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = originalSecret;
    }
    if (originalPlatformUrl === undefined) {
      delete process.env.PLATFORM_APP_URL;
    } else {
      process.env.PLATFORM_APP_URL = originalPlatformUrl;
    }
  });

  test("creates Express account with account_type express when none exists", async () => {
    const result = await propertyStripeConnectService.createExpressOnboardingLink("property-1");

    expect(result).toEqual({ url: "https://stripe.test/onboard" });
    expect(mockAccountsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "express",
      })
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        accountType: PropertyStripeAccountType.EXPRESS,
        propertyId: "property-1",
        stripeAccountId: "acct_new",
      })
    );
    expect(mockAccountLinksCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        account: "acct_new",
        type: "account_onboarding",
      })
    );
  });

  test("reuses existing Express account for onboarding link", async () => {
    mockFindByPropertyId.mockResolvedValue({
      accountType: PropertyStripeAccountType.EXPRESS,
      chargesEnabled: true,
      detailsSubmitted: true,
      onboardingComplete: true,
      payoutsEnabled: true,
      propertyId: "property-1",
      stripeAccountId: "acct_existing",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await propertyStripeConnectService.createExpressOnboardingLink("property-1");

    expect(result).toEqual({ url: "https://stripe.test/onboard" });
    expect(mockAccountsCreate).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockAccountLinksCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        account: "acct_existing",
      })
    );
  });

  test("throws conflict when property is connected via Standard", async () => {
    mockFindByPropertyId.mockResolvedValue({
      accountType: PropertyStripeAccountType.STANDARD,
      chargesEnabled: true,
      detailsSubmitted: true,
      onboardingComplete: true,
      payoutsEnabled: true,
      propertyId: "property-1",
      stripeAccountId: "acct_standard",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    await expect(
      propertyStripeConnectService.createExpressOnboardingLink("property-1")
    ).rejects.toThrow("This property is already connected to an existing Stripe account");

    expect(mockAccountsCreate).not.toHaveBeenCalled();
    expect(mockAccountLinksCreate).not.toHaveBeenCalled();
  });
});

describe("propertyStripeConnectService.createStandardOAuthAuthorizeUrl", () => {
  const originalConnectFlag = process.env.STRIPE_CONNECT_ENABLED;
  const originalStandardOAuthFlag = process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED;
  const originalClientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  const originalApiPublicUrl = process.env.API_PUBLIC_URL;
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.STRIPE_CONNECT_ENABLED = "true";
    process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED = "true";
    process.env.STRIPE_CONNECT_CLIENT_ID = "ca_test_client";
    process.env.STRIPE_SECRET_KEY = "sk_test";
    process.env.API_PUBLIC_URL = "https://api.test";
    process.env.JWT_SECRET = "jwt-test-secret";
    mockFindByPropertyId.mockReset();
    mockCreateOAuthState.mockReset();
    mockFindByPropertyId.mockResolvedValue(null);
    mockCreateOAuthState.mockResolvedValue("signed-oauth-state");
  });

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
    if (originalSecret === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = originalSecret;
    }
    if (originalApiPublicUrl === undefined) {
      delete process.env.API_PUBLIC_URL;
    } else {
      process.env.API_PUBLIC_URL = originalApiPublicUrl;
    }
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  test("returns Stripe OAuth authorize URL and stores OAuth state", async () => {
    const result = await propertyStripeConnectService.createStandardOAuthAuthorizeUrl(
      "property-1",
      "user-1"
    );

    expect(mockCreateOAuthState).toHaveBeenCalledWith({
      propertyId: "property-1",
      userId: "user-1",
    });

    const parsed = new URL(result.url);
    expect(parsed.origin + parsed.pathname).toBe("https://connect.stripe.com/oauth/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("ca_test_client");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "https://api.test/stripe/connect/oauth/callback"
    );
    expect(parsed.searchParams.get("state")).toBe("signed-oauth-state");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("scope")).toBe("read_write");
  });

  test("throws express conflict when property already has Express account", async () => {
    mockFindByPropertyId.mockResolvedValue({
      accountType: PropertyStripeAccountType.EXPRESS,
      chargesEnabled: true,
      detailsSubmitted: true,
      onboardingComplete: true,
      payoutsEnabled: true,
      propertyId: "property-1",
      stripeAccountId: "acct_existing",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(
      propertyStripeConnectService.createStandardOAuthAuthorizeUrl("property-1", "user-1")
    ).rejects.toThrow("This property uses a Stripe Express account");

    expect(mockCreateOAuthState).not.toHaveBeenCalled();
  });

  test("throws standard conflict when property already has ready Standard account", async () => {
    mockFindByPropertyId.mockResolvedValue({
      accountType: PropertyStripeAccountType.STANDARD,
      chargesEnabled: true,
      detailsSubmitted: true,
      onboardingComplete: true,
      payoutsEnabled: true,
      propertyId: "property-1",
      stripeAccountId: "acct_standard",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(
      propertyStripeConnectService.createStandardOAuthAuthorizeUrl("property-1", "user-1")
    ).rejects.toThrow("This property is already connected to an existing Stripe account");

    expect(mockCreateOAuthState).not.toHaveBeenCalled();
  });

  test("allows re-authorize when Standard account setup is incomplete", async () => {
    mockFindByPropertyId.mockResolvedValue({
      accountType: PropertyStripeAccountType.STANDARD,
      chargesEnabled: false,
      detailsSubmitted: false,
      onboardingComplete: false,
      payoutsEnabled: false,
      propertyId: "property-1",
      stripeAccountId: "acct_standard",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await propertyStripeConnectService.createStandardOAuthAuthorizeUrl(
      "property-1",
      "user-1"
    );

    expect(mockCreateOAuthState).toHaveBeenCalledWith({
      propertyId: "property-1",
      userId: "user-1",
    });
    expect(result.url).toContain("https://connect.stripe.com/oauth/authorize");
  });

  test("throws when Standard OAuth is not configured", async () => {
    delete process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED;

    await expect(
      propertyStripeConnectService.createStandardOAuthAuthorizeUrl("property-1", "user-1")
    ).rejects.toThrow("Stripe Connect Standard OAuth is not configured");
  });
});

describe("propertyStripeConnectService.completeStandardOAuthCallback", () => {
  const originalConnectFlag = process.env.STRIPE_CONNECT_ENABLED;
  const originalStandardOAuthFlag = process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED;
  const originalClientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  const originalPlatformUrl = process.env.PLATFORM_APP_URL;

  beforeEach(() => {
    process.env.STRIPE_CONNECT_ENABLED = "true";
    process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED = "true";
    process.env.STRIPE_CONNECT_CLIENT_ID = "ca_test_client";
    process.env.STRIPE_SECRET_KEY = "sk_test";
    process.env.PLATFORM_APP_URL = "https://app.test";
    mockFindByPropertyId.mockReset();
    mockUpsert.mockReset();
    mockUpdateFlags.mockReset();
    mockConsumeOAuthState.mockReset();
    mockOauthToken.mockReset();
    mockAccountsRetrieve.mockReset();
    mockFindByPropertyId.mockResolvedValue(null);
    mockConsumeOAuthState.mockResolvedValue({ propertyId: "property-1", userId: "user-1" });
    mockOauthToken.mockResolvedValue({ stripe_user_id: "acct_standard" });
    mockUpsert.mockResolvedValue({
      accountType: PropertyStripeAccountType.STANDARD,
      chargesEnabled: false,
      detailsSubmitted: false,
      onboardingComplete: false,
      payoutsEnabled: false,
      propertyId: "property-1",
      stripeAccountId: "acct_standard",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    mockUpdateFlags.mockResolvedValue({
      accountType: PropertyStripeAccountType.STANDARD,
      chargesEnabled: true,
      detailsSubmitted: true,
      onboardingComplete: true,
      payoutsEnabled: true,
      propertyId: "property-1",
      stripeAccountId: "acct_standard",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    mockAccountsRetrieve.mockResolvedValue({
      charges_enabled: true,
      details_submitted: true,
      payouts_enabled: true,
    });
  });

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
    if (originalSecret === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = originalSecret;
    }
    if (originalPlatformUrl === undefined) {
      delete process.env.PLATFORM_APP_URL;
    } else {
      process.env.PLATFORM_APP_URL = originalPlatformUrl;
    }
  });

  test("exchanges code, upserts standard account, syncs status, and redirects to return URL", async () => {
    mockFindByPropertyId.mockResolvedValueOnce(null).mockResolvedValueOnce({
      accountType: PropertyStripeAccountType.STANDARD,
      chargesEnabled: false,
      detailsSubmitted: false,
      onboardingComplete: false,
      payoutsEnabled: false,
      propertyId: "property-1",
      stripeAccountId: "acct_standard",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await propertyStripeConnectService.completeStandardOAuthCallback({
      code: "auth_code",
      state: "signed-state",
    });

    expect(mockConsumeOAuthState).toHaveBeenCalledWith("signed-state");
    expect(mockOauthToken).toHaveBeenCalledWith({
      code: "auth_code",
      grant_type: "authorization_code",
    });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        accountType: PropertyStripeAccountType.STANDARD,
        propertyId: "property-1",
        stripeAccountId: "acct_standard",
      })
    );
    expect(mockAccountsRetrieve).toHaveBeenCalled();
    expect(result.redirectUrl).toBe(
      "https://app.test/properties/property-1/settings?stripe_connect=return"
    );
  });

  test("redirects with denied reason when Stripe returns access_denied", async () => {
    const result = await propertyStripeConnectService.completeStandardOAuthCallback({
      error: "access_denied",
      state: "signed-state",
    });

    expect(result.redirectUrl).toBe(
      `https://app.test/properties/property-1/settings?stripe_connect=error&reason=${StripeConnectOAuthCallbackReason.DENIED}`
    );
    expect(mockOauthToken).not.toHaveBeenCalled();
  });

  test("redirects with invalid_state when OAuth state cannot be consumed", async () => {
    mockConsumeOAuthState.mockResolvedValue(null);

    const result = await propertyStripeConnectService.completeStandardOAuthCallback({
      code: "auth_code",
      state: "signed-state",
    });

    expect(result.redirectUrl).toBe(
      `https://app.test/?stripe_connect=error&reason=${StripeConnectOAuthCallbackReason.INVALID_STATE}`
    );
    expect(mockOauthToken).not.toHaveBeenCalled();
  });

  test("redirects with express_connected when property has an Express account", async () => {
    mockFindByPropertyId.mockResolvedValue({
      accountType: PropertyStripeAccountType.EXPRESS,
      chargesEnabled: true,
      detailsSubmitted: true,
      onboardingComplete: true,
      payoutsEnabled: true,
      propertyId: "property-1",
      stripeAccountId: "acct_existing",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await propertyStripeConnectService.completeStandardOAuthCallback({
      code: "auth_code",
      state: "signed-state",
    });

    expect(result.redirectUrl).toBe(
      `https://app.test/properties/property-1/settings?stripe_connect=error&reason=${StripeConnectOAuthCallbackReason.EXPRESS_CONNECTED}`
    );
    expect(mockOauthToken).not.toHaveBeenCalled();
  });

  test("redirects to return URL when Standard account already exists (idempotent retry)", async () => {
    mockFindByPropertyId.mockResolvedValue({
      accountType: PropertyStripeAccountType.STANDARD,
      chargesEnabled: true,
      detailsSubmitted: true,
      onboardingComplete: true,
      payoutsEnabled: true,
      propertyId: "property-1",
      stripeAccountId: "acct_standard",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await propertyStripeConnectService.completeStandardOAuthCallback({
      code: "auth_code",
      state: "signed-state",
    });

    expect(result.redirectUrl).toBe(
      "https://app.test/properties/property-1/settings?stripe_connect=return"
    );
    expect(mockOauthToken).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockAccountsRetrieve).toHaveBeenCalled();
  });

  test("redirects with invalid_grant when Stripe rejects reused authorization code", async () => {
    mockFindByPropertyId.mockResolvedValueOnce(null);
    mockOauthToken.mockRejectedValueOnce({ code: "invalid_grant" });

    const result = await propertyStripeConnectService.completeStandardOAuthCallback({
      code: "auth_code",
      state: "signed-state",
    });

    expect(result.redirectUrl).toBe(
      `https://app.test/properties/property-1/settings?stripe_connect=error&reason=${StripeConnectOAuthCallbackReason.INVALID_GRANT}`
    );
  });

  test("redirects with invalid_scope when Stripe authorize returns invalid_scope", async () => {
    const result = await propertyStripeConnectService.completeStandardOAuthCallback({
      error: "invalid_scope",
      state: "signed-state",
    });

    expect(result.redirectUrl).toBe(
      `https://app.test/properties/property-1/settings?stripe_connect=error&reason=${StripeConnectOAuthCallbackReason.INVALID_SCOPE}`
    );
  });
});

describe("propertyStripeConnectService.getStatus", () => {
  const originalFlag = process.env.STRIPE_CONNECT_ENABLED;
  const originalSecret = process.env.STRIPE_SECRET_KEY;

  beforeEach(() => {
    mockFindByPropertyId.mockReset();
    mockUpdateFlags.mockReset();
    mockAccountsRetrieve.mockReset();
    mockFindByPropertyId.mockResolvedValue(null);
    mockAccountsRetrieve.mockResolvedValue({
      charges_enabled: true,
      details_submitted: true,
      payouts_enabled: true,
    });
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.STRIPE_CONNECT_ENABLED;
    } else {
      process.env.STRIPE_CONNECT_ENABLED = originalFlag;
    }
    if (originalSecret === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = originalSecret;
    }
  });

  test("returns platformEnabled false when flag is off", async () => {
    delete process.env.STRIPE_CONNECT_ENABLED;

    const status = await propertyStripeConnectService.getStatus("property-1");

    expect(status.platformEnabled).toBe(false);
    expect(mockAccountsRetrieve).not.toHaveBeenCalled();
  });

  test("returns platformEnabled true when flag is on", async () => {
    process.env.STRIPE_CONNECT_ENABLED = "true";
    mockFindByPropertyId.mockResolvedValue(null);

    const status = await propertyStripeConnectService.getStatus("property-1");

    expect(status.platformEnabled).toBe(true);
    expect(mockAccountsRetrieve).not.toHaveBeenCalled();
  });

  test("syncAccountStatus updates flags from Stripe when flag is on", async () => {
    process.env.STRIPE_CONNECT_ENABLED = "true";
    const localAccount = {
      accountType: PropertyStripeAccountType.EXPRESS,
      chargesEnabled: false,
      detailsSubmitted: true,
      onboardingComplete: false,
      payoutsEnabled: false,
      propertyId: "property-1",
      stripeAccountId: "acct_1",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mockFindByPropertyId.mockResolvedValue(localAccount);
    mockUpdateFlags.mockResolvedValueOnce({
      ...localAccount,
      chargesEnabled: true,
      onboardingComplete: true,
      payoutsEnabled: true,
    });

    const status = await propertyStripeConnectService.syncAccountStatus("property-1");

    expect(status.platformEnabled).toBe(true);
    expect(status.chargesEnabled).toBe(true);
    expect(mockAccountsRetrieve).toHaveBeenCalled();
  });
});
