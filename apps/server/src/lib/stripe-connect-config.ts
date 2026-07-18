import { isStripeSecretConfigured } from "@/stripe/stripe-client";

import { isEnvFlagEnabled } from "./env-flag";

export class StripeConnectNotConfiguredError extends Error {
  constructor(message = "Stripe is not configured") {
    super(message);
    this.name = "StripeConnectNotConfiguredError";
  }
}

/** Gates Stripe Connect onboarding and tenant online rent payments. */
export function isStripeConnectEnabled(): boolean {
  return isEnvFlagEnabled("STRIPE_CONNECT_ENABLED");
}

export function isStripeConnectClientIdConfigured(): boolean {
  return Boolean(process.env.STRIPE_CONNECT_CLIENT_ID?.trim());
}

/**
 * Gates Standard Connect OAuth (link an existing Stripe account).
 * Requires master Connect flag, Standard OAuth flag, and Connect client id.
 */
export function isStripeConnectStandardOAuthEnabled(): boolean {
  return (
    isStripeConnectEnabled() &&
    isEnvFlagEnabled("STRIPE_CONNECT_STANDARD_OAUTH_ENABLED") &&
    isStripeConnectClientIdConfigured()
  );
}

export function requireStripeConnectOperational(): void {
  if (!isStripeConnectEnabled() || !isStripeSecretConfigured()) {
    throw new StripeConnectNotConfiguredError();
  }
}

export function requireStripeConnectStandardOAuthConfigured(): void {
  if (!isStripeConnectStandardOAuthEnabled() || !isStripeSecretConfigured()) {
    throw new StripeConnectNotConfiguredError("Stripe Connect Standard OAuth is not configured");
  }
}
