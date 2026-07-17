/**
 * Portal invite create throttling (POST .../portal-invites).
 * Defaults: 10 create requests per lease every 15 minutes.
 */
export const TENANT_PORTAL_INVITE_CREATE_RATE_LIMIT_MAX = Number.parseInt(
  process.env.TENANT_PORTAL_INVITE_CREATE_RATE_LIMIT_MAX ?? "10",
  10
);

export const TENANT_PORTAL_INVITE_CREATE_RATE_LIMIT_WINDOW_MS = Number.parseInt(
  process.env.TENANT_PORTAL_INVITE_CREATE_RATE_LIMIT_WINDOW_MS ?? "900000",
  10
);

/**
 * Tenant auth tighter limits (register/start + login), keyed by IP and email.
 * Defaults: 30 IP / 10 email attempts per action every 15 minutes.
 */
export const TENANT_AUTH_IP_RATE_LIMIT_MAX = Number.parseInt(
  process.env.TENANT_AUTH_IP_RATE_LIMIT_MAX ?? "30",
  10
);

export const TENANT_AUTH_EMAIL_RATE_LIMIT_MAX = Number.parseInt(
  process.env.TENANT_AUTH_EMAIL_RATE_LIMIT_MAX ?? "10",
  10
);

export const TENANT_AUTH_RATE_LIMIT_WINDOW_MS = Number.parseInt(
  process.env.TENANT_AUTH_RATE_LIMIT_WINDOW_MS ?? "900000",
  10
);
