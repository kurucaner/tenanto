import { derivePropertyPermissionsFromListItem } from "@/hooks/use-property-permissions";
import { isTenantEmailCampaignInProgress } from "@/lib/tenant-email-campaign-utils";
import {
  type IHomeRecentTenantEmailCampaign,
  type IProperty,
  type IUser,
  type TTenantEmailCampaignStatus,
  UserType,
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

export function hasHomeRecentCommunicationsSendAccess(
  properties: IProperty[],
  currentUser: IUser | null | undefined
): boolean {
  if (currentUser == null) {
    return false;
  }

  if (currentUser.userType === UserType.ADMIN) {
    return true;
  }

  return properties.some(
    (property) =>
      derivePropertyPermissionsFromListItem(property, currentUser).canSendTenantNotifications
  );
}
