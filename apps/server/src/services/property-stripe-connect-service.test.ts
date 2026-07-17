import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { IPropertyStripeAccount } from "@/db/property-stripe-accounts";

const mockFindByPropertyId = mock(() => Promise.resolve(null as IPropertyStripeAccount | null));
const mockUpdateFlags = mock(() => Promise.resolve(null as IPropertyStripeAccount | null));
const mockUpsert = mock(() => Promise.resolve(null as IPropertyStripeAccount | null));
const mockAccountsCreate = mock(() =>
  Promise.resolve({
    charges_enabled: false,
    details_submitted: false,
    id: "acct_new",
    payouts_enabled: false,
  })
);
const mockAccountsRetrieve = mock(() =>
  Promise.resolve({
    charges_enabled: true,
    details_submitted: true,
    payouts_enabled: true,
  })
);
const mockAccountLinksCreate = mock(() => Promise.resolve({ url: "https://stripe.test/onboard" }));

mock.module("@/db/property-stripe-accounts", () => ({
  propertyStripeAccountsDb: {
    findByPropertyId: mockFindByPropertyId,
    updateFlags: mockUpdateFlags,
    upsert: mockUpsert,
  },
  toConnectStatusResponse: (account: IPropertyStripeAccount | null, platformEnabled: boolean) => ({
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
