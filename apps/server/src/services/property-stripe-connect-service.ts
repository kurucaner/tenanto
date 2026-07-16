import { propertyStripeAccountsDb, toConnectStatusResponse } from "@/db/property-stripe-accounts";
import type {
  IPropertyStripeConnectOnboardingLinkResponse,
  IPropertyStripeConnectStatusResponse,
} from "@/packages/shared";
import { getStripeClient, isStripeSecretConfigured } from "@/stripe/stripe-client";

export class StripeConnectNotConfiguredError extends Error {
  constructor(message = "Stripe is not configured") {
    super(message);
    this.name = "StripeConnectNotConfiguredError";
  }
}

function requireStripeConfigured(): void {
  if (!isStripeSecretConfigured()) {
    throw new StripeConnectNotConfiguredError();
  }
}

function flagsFromStripeAccount(account: {
  charges_enabled: boolean | null;
  details_submitted: boolean | null;
  payouts_enabled: boolean | null;
}): {
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingComplete: boolean;
  payoutsEnabled: boolean;
} {
  const chargesEnabled = Boolean(account.charges_enabled);
  const detailsSubmitted = Boolean(account.details_submitted);
  const payoutsEnabled = Boolean(account.payouts_enabled);
  return {
    chargesEnabled,
    detailsSubmitted,
    onboardingComplete: chargesEnabled && detailsSubmitted,
    payoutsEnabled,
  };
}

function platformAppBaseUrl(): string {
  const base = process.env.PLATFORM_APP_URL?.trim().replace(/\/$/, "");
  if (!base) {
    throw new Error("PLATFORM_APP_URL is not configured");
  }
  return base;
}

export const propertyStripeConnectService = {
  async createOnboardingLink(
    propertyId: string,
    options?: { refreshUrl?: string; returnUrl?: string }
  ): Promise<IPropertyStripeConnectOnboardingLinkResponse> {
    requireStripeConfigured();
    const stripe = getStripeClient();
    const base = platformAppBaseUrl();
    const refreshUrl =
      options?.refreshUrl?.trim() ||
      `${base}/properties/${propertyId}/settings?stripe_connect=refresh`;
    const returnUrl =
      options?.returnUrl?.trim() ||
      `${base}/properties/${propertyId}/settings?stripe_connect=return`;

    let local = await propertyStripeAccountsDb.findByPropertyId(propertyId);
    if (!local) {
      const account = await stripe.accounts.create({
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        country: "US",
        type: "express",
      });
      local = await propertyStripeAccountsDb.upsert({
        chargesEnabled: Boolean(account.charges_enabled),
        detailsSubmitted: Boolean(account.details_submitted),
        onboardingComplete: false,
        payoutsEnabled: Boolean(account.payouts_enabled),
        propertyId,
        stripeAccountId: account.id,
      });
    }

    const link = await stripe.accountLinks.create({
      account: local.stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return { url: link.url };
  },

  async getStatus(propertyId: string): Promise<IPropertyStripeConnectStatusResponse> {
    const local = await propertyStripeAccountsDb.findByPropertyId(propertyId);
    if (!local || !isStripeSecretConfigured()) {
      return toConnectStatusResponse(local);
    }

    try {
      return await propertyStripeConnectService.syncAccountStatus(propertyId);
    } catch {
      return toConnectStatusResponse(local);
    }
  },

  async syncAccountStatus(propertyId: string): Promise<IPropertyStripeConnectStatusResponse> {
    requireStripeConfigured();
    const local = await propertyStripeAccountsDb.findByPropertyId(propertyId);
    if (!local) {
      return toConnectStatusResponse(null);
    }

    const stripe = getStripeClient();
    const account = await stripe.accounts.retrieve(local.stripeAccountId);
    const flags = flagsFromStripeAccount(account);
    const updated = await propertyStripeAccountsDb.updateFlags(propertyId, flags);
    return toConnectStatusResponse(updated);
  },
};
