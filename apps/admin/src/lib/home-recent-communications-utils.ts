import { isTenantEmailCampaignInProgress } from "@/lib/tenant-email-campaign-utils";
import {
  type IHomeRecentTenantEmailCampaign,
  type TTenantEmailCampaignStatus,
} from "@/packages/shared";

export function buildHomeCommunicationsCampaignHref(
  propertyId: string,
  campaignId: string
): string {
  return `/properties/${encodeURIComponent(propertyId)}/communications?campaignId=${encodeURIComponent(campaignId)}`;
}

export function buildHomeRecentCommunicationRowLabel(
  campaign: Pick<IHomeRecentTenantEmailCampaign, "propertyName" | "subject">
): string {
  return `${campaign.propertyName} / ${campaign.subject}`;
}

export function isHomeRecentTenantEmailCampaignInProgress(
  status: TTenantEmailCampaignStatus
): boolean {
  return isTenantEmailCampaignInProgress(status);
}
