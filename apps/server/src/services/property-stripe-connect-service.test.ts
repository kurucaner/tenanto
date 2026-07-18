import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { IPropertyStripeAccount } from "@/db/property-stripe-accounts";
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
    ).rejects.toThrow("This property is connected via an existing Stripe account");

    expect(mockAccountsCreate).not.toHaveBeenCalled();
    expect(mockAccountLinksCreate).not.toHaveBeenCalled();
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
