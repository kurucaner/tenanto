function isEnvFlagEnabled(name: string): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/** Gates tenant phone OTP login/bind routes (Enhancements Phase 3 / auth expansion). */
export function isTenantPhoneAuthEnabled(): boolean {
  return isEnvFlagEnabled("TENANT_PHONE_AUTH_ENABLED");
}
