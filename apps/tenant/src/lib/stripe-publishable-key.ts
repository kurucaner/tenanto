import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripePublishableKey(): string | undefined {
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim();
  return key != null && key !== "" ? key : undefined;
}

export function isTenantRentPaymentElementEnabled(): boolean {
  return getStripePublishableKey() != null;
}

export function requireStripePublishableKey(): string {
  const key = getStripePublishableKey();
  if (!key) {
    throw new Error(
      "VITE_STRIPE_PUBLISHABLE_KEY is not configured. Set it in apps/tenant/.env to pay online."
    );
  }
  return key;
}

export function getStripePromise(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = getStripePublishableKey();
    stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return stripePromise;
}
