import {
  type ITenantEmailCampaign,
  TenantEmailCampaignStatus,
  type TTenantEmailCampaignStatus,
} from "@/packages/shared";

export function isTenantEmailCampaignInProgress(status: TTenantEmailCampaignStatus): boolean {
  return (
    status === TenantEmailCampaignStatus.QUEUED || status === TenantEmailCampaignStatus.SENDING
  );
}

export function isTenantEmailCampaignTerminal(status: TTenantEmailCampaignStatus): boolean {
  return (
    status === TenantEmailCampaignStatus.COMPLETED ||
    status === TenantEmailCampaignStatus.COMPLETED_WITH_ERRORS ||
    status === TenantEmailCampaignStatus.FAILED
  );
}

export function getTenantEmailCampaignStatusLabel(status: TTenantEmailCampaignStatus): string {
  switch (status) {
    case TenantEmailCampaignStatus.QUEUED:
      return "Queued";
    case TenantEmailCampaignStatus.SENDING:
      return "Sending";
    case TenantEmailCampaignStatus.COMPLETED:
      return "Completed";
    case TenantEmailCampaignStatus.COMPLETED_WITH_ERRORS:
      return "Completed with errors";
    case TenantEmailCampaignStatus.FAILED:
      return "Failed";
    default:
      return status;
  }
}

export function getTenantEmailCampaignProcessedCount(campaign: Pick<
  ITenantEmailCampaign,
  "failedCount" | "sentCount" | "skippedCount"
>): number {
  return campaign.sentCount + campaign.failedCount + campaign.skippedCount;
}

export function formatTenantEmailCampaignDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}
