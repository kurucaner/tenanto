export const STRIPE_CONNECT_RETURN_QUERY_KEY = "stripe_connect";
export const STRIPE_CONNECT_ERROR_REASON_QUERY_KEY = "reason";

export type TStripeConnectReturnParam = "error" | "refresh" | "return";

export const StripeConnectOAuthCallbackReason = {
  DENIED: "denied",
  EXPRESS_CONNECTED: "express_connected",
  INVALID_GRANT: "invalid_grant",
  INVALID_SCOPE: "invalid_scope",
  INVALID_STATE: "invalid_state",
  MISSING_CODE: "missing_code",
  NOT_CONFIGURED: "not_configured",
  STRIPE_ACCOUNT_ALREADY_LINKED: "stripe_account_already_linked",
  STRIPE_ERROR: "stripe_error",
  TOKEN_EXCHANGE_FAILED: "token_exchange_failed",
} as const;

export type TStripeConnectOAuthCallbackReason =
  (typeof StripeConnectOAuthCallbackReason)[keyof typeof StripeConnectOAuthCallbackReason];

const STRIPE_CONNECT_OAUTH_ERROR_REASONS = new Set<string>(
  Object.values(StripeConnectOAuthCallbackReason)
);

export type TStripeConnectSettingsReturnToast = {
  description: string;
  title: string;
  type: "error" | "message" | "success";
};

export type TStripeConnectSettingsReturnOutcome = {
  toast: TStripeConnectSettingsReturnToast;
};

export function parseStripeConnectReturnParam(
  value: string | null
): TStripeConnectReturnParam | null {
  if (value === "return" || value === "refresh" || value === "error") {
    return value;
  }
  return null;
}

export function parseStripeConnectOAuthErrorReason(
  reason: string | null
): TStripeConnectOAuthCallbackReason {
  if (reason && STRIPE_CONNECT_OAUTH_ERROR_REASONS.has(reason)) {
    return reason as TStripeConnectOAuthCallbackReason;
  }
  return StripeConnectOAuthCallbackReason.STRIPE_ERROR;
}

export function getStripeConnectOAuthErrorToast(
  reason: TStripeConnectOAuthCallbackReason
): Pick<TStripeConnectSettingsReturnToast, "description" | "title"> {
  switch (reason) {
    case StripeConnectOAuthCallbackReason.DENIED:
      return {
        description: "You can connect Stripe again from property settings when you're ready.",
        title: "Stripe connection cancelled",
      };
    case StripeConnectOAuthCallbackReason.EXPRESS_CONNECTED:
      return {
        description:
          "This property uses a Stripe Express account. Use Express setup to update Stripe details.",
        title: "Property already uses Stripe Express",
      };
    case StripeConnectOAuthCallbackReason.INVALID_GRANT:
      return {
        description: "Start connecting Stripe again from property settings.",
        title: "Stripe authorization expired",
      };
    case StripeConnectOAuthCallbackReason.INVALID_SCOPE:
      return {
        description: "Connecting an existing Stripe account is not configured correctly.",
        title: "Stripe connection unavailable",
      };
    case StripeConnectOAuthCallbackReason.INVALID_STATE:
      return {
        description: "Start connecting Stripe again from property settings.",
        title: "Stripe connection session expired",
      };
    case StripeConnectOAuthCallbackReason.MISSING_CODE:
      return {
        description: "Start connecting Stripe again from property settings.",
        title: "Stripe connection incomplete",
      };
    case StripeConnectOAuthCallbackReason.NOT_CONFIGURED:
      return {
        description:
          "Connecting an existing Stripe account is not configured for this environment.",
        title: "Stripe connection unavailable",
      };
    case StripeConnectOAuthCallbackReason.STRIPE_ACCOUNT_ALREADY_LINKED:
      return {
        description:
          "This Stripe account is already connected to another property in PropertyOS. Each property needs its own Stripe account, or disconnect it from the other property first.",
        title: "Stripe account already in use",
      };
    case StripeConnectOAuthCallbackReason.TOKEN_EXCHANGE_FAILED:
      return {
        description: "Try connecting Stripe again. If this keeps happening, contact support.",
        title: "Could not finish Stripe connection",
      };
    case StripeConnectOAuthCallbackReason.STRIPE_ERROR:
    default:
      return {
        description: "Try connecting Stripe again from property settings.",
        title: "Stripe connection failed",
      };
  }
}

export function resolveStripeConnectSettingsReturn(input: {
  reason: string | null;
  stripeConnect: string | null;
}): TStripeConnectSettingsReturnOutcome | null {
  const stripeConnect = parseStripeConnectReturnParam(input.stripeConnect);
  if (!stripeConnect) {
    return null;
  }

  if (stripeConnect === "return") {
    return {
      toast: {
        description: "Refreshing account status from Stripe.",
        title: "Stripe Connect updated",
        type: "success",
      },
    };
  }

  if (stripeConnect === "refresh") {
    return {
      toast: {
        description: "Continue setup when you're ready.",
        title: "Stripe onboarding incomplete",
        type: "message",
      },
    };
  }

  const errorReason = parseStripeConnectOAuthErrorReason(input.reason);
  const errorToast = getStripeConnectOAuthErrorToast(errorReason);

  return {
    toast: {
      ...errorToast,
      type: "error",
    },
  };
}
