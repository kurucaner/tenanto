import {
  TenantEmailCampaignStatus,
  type TTenantEmailCampaignStatus,
} from "./tenant-email-campaign-types";

export function buildTenantEmailCampaignCompletionBody(
  sentCount: number,
  failedCount: number
): string {
  if (failedCount > 0) {
    return `${sentCount} sent · ${failedCount} failed`;
  }
  return `${sentCount} sent`;
}

export function buildTenantEmailCampaignCompletionTitle(input: {
  failedCount: number;
  status: TTenantEmailCampaignStatus;
}): string {
  const hasExceptions =
    input.status === TenantEmailCampaignStatus.COMPLETED_WITH_ERRORS ||
    input.status === TenantEmailCampaignStatus.FAILED ||
    input.failedCount > 0;

  return hasExceptions ? "Delivered with exceptions" : "Notification delivered";
}
