import { propertyStripeAccountsDb, toConnectStatusResponse } from "@/db/property-stripe-accounts";
import {
  stripeConnectExpressAccountConflictError,
  stripeConnectStandardAccountConflictError,
} from "@/errors/stripe-connect-errors";
import { stripeConnectAccountFlagsFromStripeAccount } from "@/lib/stripe-connect-account-flags";
import {
  isStripeConnectEnabled,
  requireStripeConnectOperational,
  requireStripeConnectStandardOAuthConfigured,
} from "@/lib/stripe-connect-config";
import {
  buildPropertyStripeConnectSettingsRedirectUrl,
  mapStripeOAuthCallbackErrorReason,
  mapStripeOAuthTokenExchangeReason,
  StripeConnectOAuthCallbackReason,
  type TStripeConnectOAuthCallbackReason,
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
  type TPropertyStripeAccountType,
} from "@/packages/shared";
import {
  logPropertyStripeConnectOAuthCompleted,
  logPropertyStripeConnectOAuthFailed,
  logPropertyStripeConnectOAuthStarted,
} from "@/services/property-stripe-connect-observability";
import { getStripeClient } from "@/stripe/stripe-client";

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

function logOAuthFailure(input: {
  accountType?: TPropertyStripeAccountType;
  err?: unknown;
  propertyId?: string;
  reason: TStripeConnectOAuthCallbackReason;
}): void {
  logPropertyStripeConnectOAuthFailed({
    accountType: input.accountType ?? PropertyStripeAccountType.STANDARD,
    err: input.err,
    propertyId: input.propertyId,
    reason: input.reason,
  });
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
      logOAuthFailure({ reason: StripeConnectOAuthCallbackReason.NOT_CONFIGURED });
      return redirect(undefined, "error", StripeConnectOAuthCallbackReason.NOT_CONFIGURED);
    }

    const stateToken = query.state?.trim();

    if (query.error) {
      const oauthState = stateToken ? await consumeStripeConnectOAuthState(stateToken) : null;
      const reason = mapStripeOAuthCallbackErrorReason(query.error);
      logOAuthFailure({ propertyId: oauthState?.propertyId, reason });
      return redirect(oauthState?.propertyId, "error", reason);
    }

    if (!query.code?.trim()) {
      const oauthState = stateToken ? await consumeStripeConnectOAuthState(stateToken) : null;
      logOAuthFailure({
        propertyId: oauthState?.propertyId,
        reason: StripeConnectOAuthCallbackReason.MISSING_CODE,
      });
      return redirect(
        oauthState?.propertyId,
        "error",
        StripeConnectOAuthCallbackReason.MISSING_CODE
      );
    }

    if (!stateToken) {
      logOAuthFailure({ reason: StripeConnectOAuthCallbackReason.INVALID_STATE });
      return redirect(undefined, "error", StripeConnectOAuthCallbackReason.INVALID_STATE);
    }

    const oauthState = await consumeStripeConnectOAuthState(stateToken);
    if (!oauthState) {
      logOAuthFailure({ reason: StripeConnectOAuthCallbackReason.INVALID_STATE });
      return redirect(undefined, "error", StripeConnectOAuthCallbackReason.INVALID_STATE);
    }

    const { propertyId } = oauthState;
    const existing = await propertyStripeAccountsDb.findByPropertyId(propertyId);
    if (existing?.accountType === PropertyStripeAccountType.STANDARD) {
      await propertyStripeConnectService.syncAccountStatus(propertyId);
      logPropertyStripeConnectOAuthCompleted({
        accountType: PropertyStripeAccountType.STANDARD,
        propertyId,
        stripeAccountId: existing.stripeAccountId,
      });
      return redirect(propertyId, "return");
    }
    if (existing) {
      logOAuthFailure({
        accountType: PropertyStripeAccountType.EXPRESS,
        propertyId,
        reason: StripeConnectOAuthCallbackReason.EXPRESS_CONNECTED,
      });
      return redirect(propertyId, "error", StripeConnectOAuthCallbackReason.EXPRESS_CONNECTED);
    }

    try {
      const stripe = getStripeClient();
      const tokenResponse = await stripe.oauth.token({
        code: query.code.trim(),
        grant_type: "authorization_code",
      });
      const stripeAccountId = tokenResponse.stripe_user_id;
      if (!stripeAccountId) {
        logOAuthFailure({
          propertyId,
          reason: StripeConnectOAuthCallbackReason.TOKEN_EXCHANGE_FAILED,
        });
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

      logPropertyStripeConnectOAuthCompleted({
        accountType: PropertyStripeAccountType.STANDARD,
        propertyId,
        stripeAccountId,
      });

      return redirect(propertyId, "return");
    } catch (error) {
      const reason = mapStripeOAuthTokenExchangeReason(error);
      logOAuthFailure({ err: error, propertyId, reason });
      return redirect(propertyId, "error", reason);
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
      throw stripeConnectStandardAccountConflictError();
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
    if (local?.accountType === PropertyStripeAccountType.EXPRESS) {
      throw stripeConnectExpressAccountConflictError();
    }
    if (local?.accountType === PropertyStripeAccountType.STANDARD && local.chargesEnabled) {
      throw stripeConnectStandardAccountConflictError();
    }

    const state = await createStripeConnectOAuthState({ propertyId, userId });
    const url = buildStripeConnectStandardOAuthAuthorizeUrl({
      clientId: stripeConnectClientId(),
      redirectUri: `${apiPublicBaseUrl()}/stripe/connect/oauth/callback`,
      state,
    });

    logPropertyStripeConnectOAuthStarted({ propertyId, userId });

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
    const flags = stripeConnectAccountFlagsFromStripeAccount(account);
    const updated = await propertyStripeAccountsDb.updateFlags(propertyId, flags);
    return toConnectStatusResponse(updated, true);
  },
};
