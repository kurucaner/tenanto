import { stripeConnectNotConfiguredError } from "@/errors/stripe-errors";
import { isStripeSecretConfigured } from "@/stripe/stripe-client";

import { isEnvFlagEnabled } from "./env-flag";

/** Gates Stripe Connect onboarding and tenant online rent payments. */
export function isStripeConnectEnabled(): boolean {
  return isEnvFlagEnabled("STRIPE_CONNECT_ENABLED");
}

export function requireStripeConnectOperational(): void {
  if (!isStripeConnectEnabled() || !isStripeSecretConfigured()) {
    throw stripeConnectNotConfiguredError();
  }
}
