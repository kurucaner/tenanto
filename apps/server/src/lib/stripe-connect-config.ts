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

export function requireStripeConnectOperational(): void {
  if (!isStripeConnectEnabled() || !isStripeSecretConfigured()) {
    throw new StripeConnectNotConfiguredError();
  }
}
