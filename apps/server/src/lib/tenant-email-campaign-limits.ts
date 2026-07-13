import { isProduction } from "./environment";
import {
  TENANT_EMAIL_CAMPAIGN_DEV_MAX_RECIPIENTS,
  TENANT_EMAIL_CAMPAIGN_MAX_RECIPIENTS,
} from "./tenant-email-campaign-config";

export function resolveTenantEmailCampaignMaxRecipients(input: {
  devMaxRecipients: number;
  isProduction: boolean;
  maxRecipients: number;
}): number {
  if (
    !input.isProduction &&
    input.devMaxRecipients > 0 &&
    input.devMaxRecipients < input.maxRecipients
  ) {
    return input.devMaxRecipients;
  }

  return input.maxRecipients;
}

export function getTenantEmailCampaignMaxRecipients(): number {
  return resolveTenantEmailCampaignMaxRecipients({
    devMaxRecipients: TENANT_EMAIL_CAMPAIGN_DEV_MAX_RECIPIENTS,
    isProduction,
    maxRecipients: TENANT_EMAIL_CAMPAIGN_MAX_RECIPIENTS,
  });
}

export function isTenantEmailCampaignCreateRateLimitExceeded(
  requestCount: number,
  limit: number
): boolean {
  return requestCount > limit;
}

export function shouldAlertTenantEmailCampaignFailureRate(input: {
  failedCount: number;
  minRecipients: number;
  sentCount: number;
  threshold: number;
}): boolean {
  const deliverableCount = input.sentCount + input.failedCount;
  if (deliverableCount < input.minRecipients) {
    return false;
  }

  return input.failedCount / deliverableCount >= input.threshold;
}
