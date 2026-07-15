import { TenantEmailCampaignStatus } from "@/packages/shared";

import { isProduction } from "./environment";
import { formatRateLimitRetryAfter, formatRateLimitWindow } from "./rate-limit-messages";
import { isFixedWindowRateLimitExceeded } from "./redis-fixed-window-rate-limit";
import {
  TENANT_EMAIL_CAMPAIGN_DEV_MAX_RECIPIENTS,
  TENANT_EMAIL_CAMPAIGN_MAX_RECIPIENTS,
} from "./tenant-email-campaign-config";

export function isTerminalTenantEmailCampaignStatus(status: string): boolean {
  return (
    status === TenantEmailCampaignStatus.COMPLETED ||
    status === TenantEmailCampaignStatus.COMPLETED_WITH_ERRORS ||
    status === TenantEmailCampaignStatus.FAILED
  );
}

export function didTenantEmailCampaignTransitionToTerminal(
  previousStatus: string,
  nextStatus: string
): boolean {
  return (
    isTerminalTenantEmailCampaignStatus(nextStatus) &&
    !isTerminalTenantEmailCampaignStatus(previousStatus)
  );
}

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
  return isFixedWindowRateLimitExceeded(requestCount, limit);
}

export function formatTenantEmailCampaignRateLimitWindow(windowMs: number): string {
  return formatRateLimitWindow(windowMs);
}

export function formatTenantEmailCampaignRetryAfter(retryAfterSec: number): string {
  return formatRateLimitRetryAfter(retryAfterSec);
}

export function getTenantEmailCampaignCreateRateLimitErrorMessage(input: {
  limit: number;
  retryAfterSec: number;
  windowMs: number;
}): string {
  const campaignWord = input.limit === 1 ? "campaign" : "campaigns";
  const windowLabel = formatRateLimitWindow(input.windowMs);
  const retryLabel = formatRateLimitRetryAfter(input.retryAfterSec);

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
