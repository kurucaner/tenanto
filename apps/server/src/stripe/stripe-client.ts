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

function requireWebhookSecret(): string {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  return webhookSecret;
}

/** Raw body as bytes Stripe's verifier accepts (Buffer is a Uint8Array subclass). */
function toWebhookPayload(payload: string | Buffer): string | Uint8Array {
  return typeof payload === "string" ? payload : new Uint8Array(payload);
}

function peekWebhookObject(payload: string | Buffer): string | null {
  const text = typeof payload === "string" ? payload : payload.toString("utf8");
  try {
    const parsed = JSON.parse(text) as { object?: unknown };
    return typeof parsed.object === "string" ? parsed.object : null;
  } catch {
    return null;
  }
}

export type TVerifiedStripeWebhook =
  | { kind: "snapshot"; event: Stripe.Event }
  | { kind: "thin"; notification: Stripe.V2.Core.EventNotification };

/**
 * Verify signature and parse classic snapshot events (`object: "event"`) or
 * thin Event Destination notifications (`object: "v2.core.event"`).
 */
export function verifyStripeWebhookPayload(
  payload: string | Buffer,
  signatureHeader: string
): TVerifiedStripeWebhook {
  const webhookSecret = requireWebhookSecret();
  const stripe = getStripeClient();
  const body = toWebhookPayload(payload);
  const object = peekWebhookObject(payload);

  if (object === "v2.core.event") {
    return {
      kind: "thin",
      notification: stripe.parseEventNotification(body, signatureHeader, webhookSecret),
    };
  }

  return {
    event: stripe.webhooks.constructEvent(body, signatureHeader, webhookSecret),
    kind: "snapshot",
  };
}

/** Snapshot webhook verify helper (thin events: use verifyStripeWebhookPayload). */
export function constructStripeWebhookEvent(
  payload: string | Buffer,
  signatureHeader: string
): Stripe.Event {
  const verified = verifyStripeWebhookPayload(payload, signatureHeader);
  if (verified.kind !== "snapshot") {
    throw new Error(
      "Received a thin event notification; use verifyStripeWebhookPayload / parseEventNotification"
    );
  }
  return verified.event;
}

/** Reset singleton (tests only). */
export function resetStripeClientForTests(): void {
  stripeClient = null;
}
