import { propertyStripeAccountsDb, toConnectStatusResponse } from "@/db/property-stripe-accounts";
import { stripeConnectConflictError } from "@/errors/stripe-connect-errors";
import {
  isStripeConnectEnabled,
  requireStripeConnectOperational,
  requireStripeConnectStandardOAuthConfigured,
} from "@/lib/stripe-connect-config";
import { createStripeConnectOAuthState } from "@/lib/stripe-connect-oauth-state";
import { buildStripeConnectStandardOAuthAuthorizeUrl } from "@/lib/stripe-connect-oauth-url";
import {
  type IPropertyStripeConnectAuthorizeUrlResponse,
  type IPropertyStripeConnectOnboardingLinkResponse,
  type IPropertyStripeConnectStatusResponse,
  PropertyStripeAccountType,
} from "@/packages/shared";
import { getStripeClient } from "@/stripe/stripe-client";

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

function apiPublicBaseUrl(): string {
  const base = process.env.API_PUBLIC_URL?.trim().replace(/\/$/, "");
  if (!base) {
    throw new Error("API_PUBLIC_URL is not configured");
  }
  return base;
}

function stripeConnectClientId(): string {
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("STRIPE_CONNECT_CLIENT_ID is not configured");
  }
  return clientId;
}

export const propertyStripeConnectService = {
  async createExpressOnboardingLink(
    propertyId: string,
    options?: { refreshUrl?: string; returnUrl?: string }
  ): Promise<IPropertyStripeConnectOnboardingLinkResponse> {
    requireStripeConnectOperational();
    const stripe = getStripeClient();
    const base = platformAppBaseUrl();
    const refreshUrl =
      options?.refreshUrl?.trim() ||
      `${base}/properties/${propertyId}/settings?stripe_connect=refresh`;
    const returnUrl =
      options?.returnUrl?.trim() ||
      `${base}/properties/${propertyId}/settings?stripe_connect=return`;

    let local = await propertyStripeAccountsDb.findByPropertyId(propertyId);
    if (local?.accountType === PropertyStripeAccountType.STANDARD) {
      throw stripeConnectConflictError(
        "This property is connected via an existing Stripe account. Use Standard OAuth to reconnect."
      );
    }

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
        accountType: PropertyStripeAccountType.EXPRESS,
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

  /** @deprecated Use createExpressOnboardingLink — kept for route alias during rollout. */
  createOnboardingLink(
    propertyId: string,
    options?: { refreshUrl?: string; returnUrl?: string }
  ): Promise<IPropertyStripeConnectOnboardingLinkResponse> {
    return propertyStripeConnectService.createExpressOnboardingLink(propertyId, options);
  },

  async createStandardOAuthAuthorizeUrl(
    propertyId: string,
    userId: string
  ): Promise<IPropertyStripeConnectAuthorizeUrlResponse> {
    requireStripeConnectStandardOAuthConfigured();

    const local = await propertyStripeAccountsDb.findByPropertyId(propertyId);
    if (local) {
      throw stripeConnectConflictError();
    }

    const state = await createStripeConnectOAuthState({ propertyId, userId });
    const url = buildStripeConnectStandardOAuthAuthorizeUrl({
      clientId: stripeConnectClientId(),
      redirectUri: `${apiPublicBaseUrl()}/stripe/connect/oauth/callback`,
      state,
    });

    return { url };
  },

  async getStatus(propertyId: string): Promise<IPropertyStripeConnectStatusResponse> {
    const platformEnabled = isStripeConnectEnabled();
    const local = await propertyStripeAccountsDb.findByPropertyId(propertyId);

    if (!platformEnabled) {
      return toConnectStatusResponse(local, false);
    }

    if (!local) {
      return toConnectStatusResponse(null, true);
    }

    try {
      return await propertyStripeConnectService.syncAccountStatus(propertyId);
    } catch {
      return toConnectStatusResponse(local, true);
    }
  },

  async syncAccountStatus(propertyId: string): Promise<IPropertyStripeConnectStatusResponse> {
    requireStripeConnectOperational();
    const local = await propertyStripeAccountsDb.findByPropertyId(propertyId);
    if (!local) {
      return toConnectStatusResponse(null, true);
    }

    const stripe = getStripeClient();
    const account = await stripe.accounts.retrieve(local.stripeAccountId);
    const flags = flagsFromStripeAccount(account);
    const updated = await propertyStripeAccountsDb.updateFlags(propertyId, flags);
    return toConnectStatusResponse(updated, true);
  },
};
