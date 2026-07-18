import { stripeConnectNotConfiguredError } from "@/errors/stripe-connect-errors";
import { isStripeSecretConfigured } from "@/stripe/stripe-client";

import { isEnvFlagEnabled } from "./env-flag";

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
    throw stripeConnectNotConfiguredError();
  }
}

export function requireStripeConnectStandardOAuthConfigured(): void {
  if (!isStripeConnectStandardOAuthEnabled() || !isStripeSecretConfigured()) {
    throw stripeConnectNotConfiguredError("Stripe Connect Standard OAuth is not configured");
  }
}
