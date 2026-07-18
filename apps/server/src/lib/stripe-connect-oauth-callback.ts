export const StripeConnectOAuthCallbackReason = {
  DENIED: "denied",
  EXPRESS_CONNECTED: "express_connected",
  INVALID_GRANT: "invalid_grant",
  INVALID_SCOPE: "invalid_scope",
  INVALID_STATE: "invalid_state",
  MISSING_CODE: "missing_code",
  NOT_CONFIGURED: "not_configured",
  STRIPE_ERROR: "stripe_error",
  TOKEN_EXCHANGE_FAILED: "token_exchange_failed",
} as const;

export type TStripeConnectOAuthCallbackReason =
  (typeof StripeConnectOAuthCallbackReason)[keyof typeof StripeConnectOAuthCallbackReason];

export function buildPropertyStripeConnectSettingsRedirectUrl(input: {
  platformAppUrl: string;
  propertyId?: string;
  stripeConnect: "error" | "return";
  reason?: TStripeConnectOAuthCallbackReason;
}): string {
  const base = input.platformAppUrl.replace(/\/$/, "");
  const path = input.propertyId ? `${base}/properties/${input.propertyId}/settings` : base;
  const url = new URL(path);

  url.searchParams.set("stripe_connect", input.stripeConnect);
  if (input.stripeConnect === "error" && input.reason) {
    url.searchParams.set("reason", input.reason);
  }

  return url.toString();
}

/** Maps Stripe OAuth authorize redirect `error` query params to stable callback reasons. */
export function mapStripeOAuthCallbackErrorReason(
  stripeError: string | undefined
): TStripeConnectOAuthCallbackReason {
  switch (stripeError) {
    case "access_denied":
      return StripeConnectOAuthCallbackReason.DENIED;
    case "invalid_scope":
      return StripeConnectOAuthCallbackReason.INVALID_SCOPE;
    default:
      return StripeConnectOAuthCallbackReason.STRIPE_ERROR;
  }
}

function readStripeErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/** Maps Stripe `oauth.token` failures to stable callback reasons. */
export function mapStripeOAuthTokenExchangeReason(
  error: unknown
): TStripeConnectOAuthCallbackReason {
  const code = readStripeErrorCode(error);
  if (code === "invalid_grant") {
    return StripeConnectOAuthCallbackReason.INVALID_GRANT;
  }
  return StripeConnectOAuthCallbackReason.TOKEN_EXCHANGE_FAILED;
}
