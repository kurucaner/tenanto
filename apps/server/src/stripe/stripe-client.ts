import Stripe from "stripe";

/** API version pinned to the installed `stripe` package (`ApiVersion`). */
export const STRIPE_API_VERSION = "2026-06-24.dahlia" as const;

let stripeClient: Stripe | null = null;

export function isStripeSecretConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

/**
 * Lazy Stripe SDK singleton. Throws if `STRIPE_SECRET_KEY` is missing —
 * call only when rent payments / Connect is enabled and configured.
 */
export function getStripeClient(): Stripe {
  if (stripeClient) {
    return stripeClient;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  });

  return stripeClient;
}

/** Verify webhook signature; requires `STRIPE_WEBHOOK_SECRET`. */
export function constructStripeWebhookEvent(
  payload: string | Buffer,
  signatureHeader: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  return getStripeClient().webhooks.constructEvent(payload, signatureHeader, webhookSecret);
}

/** Reset singleton (tests only). */
export function resetStripeClientForTests(): void {
  stripeClient = null;
}
