import { isEnvFlagEnabled } from "./env-flag";

/** Gates tenant lease/rent/portal-invite transactional emails. */
export function isTenantEmailNotificationsEnabled(): boolean {
  return isEnvFlagEnabled("TENANT_EMAIL_NOTIFICATIONS_ENABLED");
}
