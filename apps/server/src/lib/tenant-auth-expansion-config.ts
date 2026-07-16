import { isEnvFlagEnabled } from "./env-flag";

/** Gates tenant phone OTP login/bind routes (Enhancements Phase 3 / auth expansion). */
export function isTenantPhoneAuthEnabled(): boolean {
  return isEnvFlagEnabled("TENANT_PHONE_AUTH_ENABLED");
}
