import { getPostgresErrorMeta, isPostgresUniqueViolation } from "@/db/pg-errors";

export const PROPERTY_STRIPE_ACCOUNTS_STRIPE_ACCOUNT_ID_UNIQ =
  "property_stripe_accounts_stripe_account_id_uniq";

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

/** Maps Standard OAuth finish-step failures (token exchange, DB, sync) to stable callback reasons. */
export function mapStandardOAuthFinishReason(error: unknown): TStripeConnectOAuthCallbackReason {
  if (isPostgresUniqueViolation(error)) {
    const constraint = getPostgresErrorMeta(error)?.constraint;
    if (constraint === PROPERTY_STRIPE_ACCOUNTS_STRIPE_ACCOUNT_ID_UNIQ) {
      return StripeConnectOAuthCallbackReason.STRIPE_ACCOUNT_ALREADY_LINKED;
    }
  }

  const code = readStripeErrorCode(error);
  if (code === "invalid_grant") {
    return StripeConnectOAuthCallbackReason.INVALID_GRANT;
  }
  return StripeConnectOAuthCallbackReason.TOKEN_EXCHANGE_FAILED;
}
