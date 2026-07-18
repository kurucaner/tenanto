export const StripeConnectOAuthCallbackReason = {
  ALREADY_CONNECTED: "already_connected",
  DENIED: "denied",
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

export function mapStripeOAuthCallbackErrorReason(
  stripeError: string | undefined
): TStripeConnectOAuthCallbackReason {
  if (stripeError === "access_denied") {
    return StripeConnectOAuthCallbackReason.DENIED;
  }
  return StripeConnectOAuthCallbackReason.STRIPE_ERROR;
}
