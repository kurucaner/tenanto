export function isTenantEmailCampaignsUiEnabled(): boolean {
  return import.meta.env.VITE_TENANT_EMAIL_CAMPAIGNS_ENABLED === "true";
}
