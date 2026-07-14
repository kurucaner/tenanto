import { isPostgresUniqueViolation } from "@/db/pg-errors";
import {
  buildTenantEmailCampaignCompletionBody,
  buildTenantEmailCampaignCompletionTitle,
  type ITenantEmailCampaign,
} from "@/packages/shared";
import { notifyUser } from "@/services/user-notifications";

export async function notifyTenantEmailCampaignCompleted(
  campaign: ITenantEmailCampaign
): Promise<void> {
  try {
    await notifyUser({
      body: buildTenantEmailCampaignCompletionBody(campaign.sentCount, campaign.failedCount),
      contextResourceId: campaign.id,
      resourceId: campaign.propertyId,
      resourceType: "property",
      title: buildTenantEmailCampaignCompletionTitle({
        failedCount: campaign.failedCount,
        status: campaign.status,
      }),
      type: "tenant_email_campaign_completed",
      userId: campaign.createdBy,
    });
  } catch (error) {
    if (isPostgresUniqueViolation(error)) {
      return;
    }
    throw error;
  }
}
