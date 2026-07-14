import { propertyTenantEmailCampaignsDb } from "@/db/property-tenant-email-campaigns";
import { TenantEmailCampaignStatus, type TTenantEmailCampaignStatus } from "@/packages/shared";

import { notificationStreamHub } from "./notification-stream-hub";
import { notifyTenantEmailCampaignCompleted } from "./tenant-email-campaign-notifications";
import { maybeLogTenantEmailCampaignCompletion } from "./tenant-email-campaign-observability";

const PROGRESS_EMIT_INTERVAL_MS = 2_000;
const PROGRESS_EMIT_SENT_DELTA = 10;

interface ICampaignEmitThrottleState {
  lastEmitAtMs: number;
  lastSentCount: number;
}

const throttleByCampaign = new Map<string, ICampaignEmitThrottleState>();

function isTerminalCampaignStatus(status: TTenantEmailCampaignStatus): boolean {
  return (
    status === TenantEmailCampaignStatus.COMPLETED ||
    status === TenantEmailCampaignStatus.COMPLETED_WITH_ERRORS ||
    status === TenantEmailCampaignStatus.FAILED
  );
}

export function shouldEmitTenantEmailCampaignUpdate(
  campaignId: string,
  sentCount: number,
  status: TTenantEmailCampaignStatus,
  nowMs = Date.now()
): boolean {
  if (isTerminalCampaignStatus(status)) {
    throttleByCampaign.delete(campaignId);
    return true;
  }

  const previous = throttleByCampaign.get(campaignId);
  if (previous == null) {
    throttleByCampaign.set(campaignId, { lastEmitAtMs: nowMs, lastSentCount: sentCount });
    return true;
  }

  const sentDelta = sentCount - previous.lastSentCount;
  const elapsedMs = nowMs - previous.lastEmitAtMs;
  if (sentDelta >= PROGRESS_EMIT_SENT_DELTA || elapsedMs >= PROGRESS_EMIT_INTERVAL_MS) {
    throttleByCampaign.set(campaignId, { lastEmitAtMs: nowMs, lastSentCount: sentCount });
    return true;
  }

  return false;
}

export function resetTenantEmailCampaignStreamThrottle(campaignId?: string): void {
  if (campaignId == null) {
    throttleByCampaign.clear();
    return;
  }
  throttleByCampaign.delete(campaignId);
}

export async function maybePublishTenantEmailCampaignUpdated(
  campaignId: string,
  options?: { transitionedToTerminal?: boolean }
): Promise<void> {
  const campaign = await propertyTenantEmailCampaignsDb.findById(campaignId);
  if (campaign == null) {
    return;
  }

  if (!shouldEmitTenantEmailCampaignUpdate(campaignId, campaign.sentCount, campaign.status)) {
    return;
  }

  maybeLogTenantEmailCampaignCompletion(campaign);

  await notificationStreamHub.publishTenantEmailCampaignUpdated({
    campaignId: campaign.id,
    failedCount: campaign.failedCount,
    propertyId: campaign.propertyId,
    sentCount: campaign.sentCount,
    skippedCount: campaign.skippedCount,
    status: campaign.status,
    totalCount: campaign.recipientCount,
    userId: campaign.createdBy,
  });

  if (options?.transitionedToTerminal === true && isTerminalCampaignStatus(campaign.status)) {
    await notifyTenantEmailCampaignCompleted(campaign);
  }
}
