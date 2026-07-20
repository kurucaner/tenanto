import type { ITenantEmailCampaignListItem } from "./tenant-email-campaign-types";

export const HOME_RECENT_TENANT_EMAIL_CAMPAIGNS_LIMIT = 6;

export interface IHomeRecentTenantEmailCampaign extends ITenantEmailCampaignListItem {
  propertyName: string;
}

export interface IHomeRecentTenantEmailCampaignsResponse {
  campaigns: IHomeRecentTenantEmailCampaign[];
}
