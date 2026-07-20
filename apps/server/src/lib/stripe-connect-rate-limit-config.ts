/** Max Stripe Connect onboarding/OAuth link requests per property owner per window. */
export const STRIPE_CONNECT_LINK_RATE_LIMIT_MAX = Number.parseInt(
  process.env.STRIPE_CONNECT_LINK_RATE_LIMIT_MAX ?? "10",
  10
);

/** Fixed window for Stripe Connect link rate limits (default: 15 minutes). */
export const STRIPE_CONNECT_LINK_RATE_LIMIT_WINDOW_MS = Number.parseInt(
  process.env.STRIPE_CONNECT_LINK_RATE_LIMIT_WINDOW_MS ?? "900000",
  10
);
