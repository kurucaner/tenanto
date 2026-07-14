import {
  TENANT_EMAIL_CAMPAIGN_FAILURE_ALERT_MIN_RECIPIENTS,
  TENANT_EMAIL_CAMPAIGN_FAILURE_ALERT_RATE,
} from "@/lib/tenant-email-campaign-config";
import { shouldAlertTenantEmailCampaignFailureRate } from "@/lib/tenant-email-campaign-limits";
import {
  type ITenantEmailCampaign,
  TenantEmailCampaignStatus,
  type TTenantEmailCampaignStatus,
} from "@/packages/shared";

import { WinstonLogger } from "./winston";

function isTerminalCampaignStatus(status: TTenantEmailCampaignStatus): boolean {
  return (
    status === TenantEmailCampaignStatus.COMPLETED ||
    status === TenantEmailCampaignStatus.COMPLETED_WITH_ERRORS ||
    status === TenantEmailCampaignStatus.FAILED
  );
}

export function logTenantEmailCampaignCreated(campaign: {
  createdBy: string;
  id: string;
  propertyId: string;
  recipientCount: number;
  skippedCount: number;
}): void {
  WinstonLogger.info("tenant_email_campaign.created", {
    campaignId: campaign.id,
    createdBy: campaign.createdBy,
    propertyId: campaign.propertyId,
    recipientCount: campaign.recipientCount,
    skippedCount: campaign.skippedCount,
  });
}

export function logTenantEmailRecipientSent(input: {
  campaignId: string;
  propertyId: string;
  recipientId: string;
}): void {
  WinstonLogger.info("tenant_email_campaign.recipient.sent", input);
}

export function logTenantEmailRecipientFailed(input: {
  campaignId: string;
  errorMessage: string;
  propertyId: string;
  recipientId: string;
}): void {
  WinstonLogger.warn("tenant_email_campaign.recipient.failed", input);
}

export function logTenantEmailRecipientSkipped(input: {
  campaignId: string;
  propertyId: string;
  reason: string;
  recipientId: string;
}): void {
  WinstonLogger.info("tenant_email_campaign.recipient.skipped", input);
}

export function logTenantEmailWorkerJobFailed(input: {
  campaignId: string;
  errorMessage: string;
  recipientId: string;
}): void {
  WinstonLogger.error("tenant_email_campaign.worker.job_failed", input);
}

export function maybeLogTenantEmailCampaignCompletion(campaign: ITenantEmailCampaign): void {
  if (!isTerminalCampaignStatus(campaign.status)) {
    return;
  }

  WinstonLogger.info("tenant_email_campaign.completed", {
    campaignId: campaign.id,
    failedCount: campaign.failedCount,
    propertyId: campaign.propertyId,
    recipientCount: campaign.recipientCount,
    sentCount: campaign.sentCount,
    skippedCount: campaign.skippedCount,
    status: campaign.status,
  });

  if (
    shouldAlertTenantEmailCampaignFailureRate({
      failedCount: campaign.failedCount,
      minRecipients: TENANT_EMAIL_CAMPAIGN_FAILURE_ALERT_MIN_RECIPIENTS,
      sentCount: campaign.sentCount,
      threshold: TENANT_EMAIL_CAMPAIGN_FAILURE_ALERT_RATE,
    })
  ) {
    WinstonLogger.warn("tenant_email_campaign.high_failure_rate", {
      campaignId: campaign.id,
      failedCount: campaign.failedCount,
      propertyId: campaign.propertyId,
      recipientCount: campaign.recipientCount,
      sentCount: campaign.sentCount,
      threshold: TENANT_EMAIL_CAMPAIGN_FAILURE_ALERT_RATE,
    });
  }
}
