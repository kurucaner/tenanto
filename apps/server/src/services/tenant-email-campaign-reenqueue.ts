import { propertyTenantEmailCampaignsDb } from "@/db/property-tenant-email-campaigns";
import { type ITenantEmailCampaignReenqueueResponse } from "@/packages/shared";
import { enqueueTenantEmailSendJobs } from "@/queues/tenant-email-queue";

import { WinstonLogger } from "./winston";

export class TenantEmailCampaignNotFoundError extends Error {
  constructor() {
    super("Campaign not found");
    this.name = "TenantEmailCampaignNotFoundError";
  }
}

export async function reenqueueQueuedRecipientsForCampaign(
  campaignId: string,
  propertyId?: string
): Promise<ITenantEmailCampaignReenqueueResponse> {
  const campaign = await propertyTenantEmailCampaignsDb.findById(campaignId);
  if (campaign == null || (propertyId != null && campaign.propertyId !== propertyId)) {
    throw new TenantEmailCampaignNotFoundError();
  }

  const queuedRecipientIds =
    await propertyTenantEmailCampaignsDb.listQueuedRecipientIds(campaignId);
  const enqueuedCount =
    queuedRecipientIds.length > 0
      ? await enqueueTenantEmailSendJobs(campaignId, queuedRecipientIds)
      : 0;

  if (enqueuedCount > 0) {
    WinstonLogger.info("tenant_email_campaign.reenqueued", {
      campaignId,
      enqueuedCount,
      propertyId: campaign.propertyId,
    });
  }

  const refreshed = (await propertyTenantEmailCampaignsDb.findById(campaignId)) ?? campaign;

  return {
    campaignId: refreshed.id,
    enqueuedCount,
    status: refreshed.status,
  };
}

export async function reenqueueAllStuckTenantEmailCampaigns(): Promise<number> {
  const campaignIds = await propertyTenantEmailCampaignsDb.listCampaignIdsWithQueuedRecipients();
  let totalEnqueued = 0;

  for (const campaignId of campaignIds) {
    const result = await reenqueueQueuedRecipientsForCampaign(campaignId);
    totalEnqueued += result.enqueuedCount;
  }

  if (totalEnqueued > 0) {
    WinstonLogger.info("tenant_email_campaign.startup_reenqueue", {
      campaignCount: campaignIds.length,
      enqueuedCount: totalEnqueued,
    });
  }

  return totalEnqueued;
}
