import { propertyStripeAccountsDb, toConnectStatusResponse } from "@/db/property-stripe-accounts";
import { stripeConnectConflictError } from "@/errors/stripe-connect-errors";
import {
  isStripeConnectEnabled,
  requireStripeConnectOperational,
  requireStripeConnectStandardOAuthConfigured,
} from "@/lib/stripe-connect-config";
import {
  buildPropertyStripeConnectSettingsRedirectUrl,
  mapStripeOAuthCallbackErrorReason,
  StripeConnectOAuthCallbackReason,
} from "@/lib/stripe-connect-oauth-callback";
import {
  consumeStripeConnectOAuthState,
  createStripeConnectOAuthState,
} from "@/lib/stripe-connect-oauth-state";
import { buildStripeConnectStandardOAuthAuthorizeUrl } from "@/lib/stripe-connect-oauth-url";
import {
  type IPropertyStripeConnectAuthorizeUrlResponse,
  type IPropertyStripeConnectOnboardingLinkResponse,
  type IPropertyStripeConnectStatusResponse,
  PropertyStripeAccountType,
} from "@/packages/shared";
import { WinstonLogger } from "@/services/winston";
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
  async completeStandardOAuthCallback(query: {
    code?: string;
    error?: string;
    state?: string;
  }): Promise<{ redirectUrl: string }> {
    const platformAppUrl = platformAppBaseUrl();
    const redirect = (
      propertyId: string | undefined,
      stripeConnect: "error" | "return",
      reason?: (typeof StripeConnectOAuthCallbackReason)[keyof typeof StripeConnectOAuthCallbackReason]
    ) => ({
      redirectUrl: buildPropertyStripeConnectSettingsRedirectUrl({
        platformAppUrl,
        propertyId,
        reason,
        stripeConnect,
      }),
    });

    try {
      requireStripeConnectStandardOAuthConfigured();
    } catch {
      return redirect(undefined, "error", StripeConnectOAuthCallbackReason.NOT_CONFIGURED);
    }

    const stateToken = query.state?.trim();

    if (query.error) {
      const oauthState = stateToken ? await consumeStripeConnectOAuthState(stateToken) : null;
      return redirect(
        oauthState?.propertyId,
        "error",
        mapStripeOAuthCallbackErrorReason(query.error)
      );
    }

    if (!query.code?.trim()) {
      const oauthState = stateToken ? await consumeStripeConnectOAuthState(stateToken) : null;
      return redirect(
        oauthState?.propertyId,
        "error",
        StripeConnectOAuthCallbackReason.MISSING_CODE
      );
    }

    if (!stateToken) {
      return redirect(undefined, "error", StripeConnectOAuthCallbackReason.INVALID_STATE);
    }

    const oauthState = await consumeStripeConnectOAuthState(stateToken);
    if (!oauthState) {
      return redirect(undefined, "error", StripeConnectOAuthCallbackReason.INVALID_STATE);
    }

    const { propertyId } = oauthState;
    const existing = await propertyStripeAccountsDb.findByPropertyId(propertyId);
    if (existing) {
      return redirect(propertyId, "error", StripeConnectOAuthCallbackReason.ALREADY_CONNECTED);
    }

    try {
      const stripe = getStripeClient();
      const tokenResponse = await stripe.oauth.token({
        code: query.code.trim(),
        grant_type: "authorization_code",
      });
      const stripeAccountId = tokenResponse.stripe_user_id;
      if (!stripeAccountId) {
        return redirect(
          propertyId,
          "error",
          StripeConnectOAuthCallbackReason.TOKEN_EXCHANGE_FAILED
        );
      }

      await propertyStripeAccountsDb.upsert({
        accountType: PropertyStripeAccountType.STANDARD,
        chargesEnabled: false,
        detailsSubmitted: false,
        onboardingComplete: false,
        payoutsEnabled: false,
        propertyId,
        stripeAccountId,
      });

      await propertyStripeConnectService.syncAccountStatus(propertyId);

      WinstonLogger.info({
        accountType: PropertyStripeAccountType.STANDARD,
        msg: "tenant_payments.connect_oauth_completed",
        propertyId,
        stripeAccountId,
      });

      return redirect(propertyId, "return");
    } catch (error) {
      WinstonLogger.error({
        err: error,
        msg: "tenant_payments.connect_oauth_failed",
        propertyId,
      });
      return redirect(propertyId, "error", StripeConnectOAuthCallbackReason.TOKEN_EXCHANGE_FAILED);
    }
  },

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
