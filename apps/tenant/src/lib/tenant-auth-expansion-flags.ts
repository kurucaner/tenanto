function isViteFlagEnabled(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

/** Mirrors server `TENANT_PHONE_AUTH_ENABLED` — hide phone auth UI when off. */
export function isTenantPhoneAuthEnabled(): boolean {
  return isViteFlagEnabled(import.meta.env.VITE_TENANT_PHONE_AUTH_ENABLED);
}
