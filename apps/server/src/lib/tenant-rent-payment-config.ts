/** Hourly at :30 — recover missed rent-payment webhooks / alert gaps. */
export const TENANT_RENT_PAYMENT_RECONCILE_CRON_SCHEDULE = "30 * * * *";

/** How far back to scan Stripe PaymentIntents and local open payments. */
export const TENANT_RENT_PAYMENT_RECONCILE_LOOKBACK_HOURS = 48;

/** Max PaymentIntents to page from Stripe per reconcile run. */
export const TENANT_RENT_PAYMENT_RECONCILE_STRIPE_LIMIT = 100;
