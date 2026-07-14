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

export function formatTenantEmailCampaignRateLimitWindow(windowMs: number): string {
  const totalMinutes = Math.max(1, Math.round(windowMs / 60_000));

  if (totalMinutes >= 60 && totalMinutes % 60 === 0) {
    const hours = totalMinutes / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }

  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const hourLabel = hours === 1 ? "1 hour" : `${hours} hours`;
    const minuteLabel = minutes === 1 ? "1 minute" : `${minutes} minutes`;
    return `${hourLabel} ${minuteLabel}`;
  }

  return totalMinutes === 1 ? "1 minute" : `${totalMinutes} minutes`;
}

export function formatTenantEmailCampaignRetryAfter(retryAfterSec: number): string {
  const safeRetryAfterSec = Math.max(1, Math.ceil(retryAfterSec));

  if (safeRetryAfterSec >= 3600 && safeRetryAfterSec % 3600 === 0) {
    const hours = safeRetryAfterSec / 3600;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }

  if (safeRetryAfterSec >= 120) {
    const minutes = Math.ceil(safeRetryAfterSec / 60);
    return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  }

  return safeRetryAfterSec === 1 ? "1 second" : `${safeRetryAfterSec} seconds`;
}

export function getTenantEmailCampaignCreateRateLimitErrorMessage(input: {
  limit: number;
  retryAfterSec: number;
  windowMs: number;
}): string {
  const campaignWord = input.limit === 1 ? "campaign" : "campaigns";
  const windowLabel = formatTenantEmailCampaignRateLimitWindow(input.windowMs);
  const retryLabel = formatTenantEmailCampaignRetryAfter(input.retryAfterSec);

  return `You can send at most ${input.limit} tenant email ${campaignWord} per property every ${windowLabel}. Try again in ${retryLabel}.`;
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
