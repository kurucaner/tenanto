import { toast } from "sonner";

import { router } from "@/app/router";
import { isTenantEmailCampaignTerminal } from "@/lib/tenant-email-campaign-utils";
import {
  TenantEmailCampaignStatus,
  type TTenantEmailCampaignStatus,
} from "@/packages/shared";

export interface ITenantEmailCampaignCompletedToastInput {
  campaignId: string;
  failedCount: number;
  propertyId: string;
  sentCount: number;
  status: TTenantEmailCampaignStatus;
}

function buildCampaignCompletedDescription(sentCount: number, failedCount: number): string {
  if (failedCount > 0) {
    return `${sentCount} sent · ${failedCount} failed`;
  }
  return `${sentCount} sent`;
}

function hasCampaignDeliveryExceptions(
  status: TTenantEmailCampaignStatus,
  failedCount: number
): boolean {
  return (
    status === TenantEmailCampaignStatus.COMPLETED_WITH_ERRORS ||
    status === TenantEmailCampaignStatus.FAILED ||
    failedCount > 0
  );
}

export function showTenantEmailCampaignCompletedToast(
  input: ITenantEmailCampaignCompletedToastInput
): void {
  if (!isTenantEmailCampaignTerminal(input.status)) {
    return;
  }

  const description = buildCampaignCompletedDescription(input.sentCount, input.failedCount);
  const action = {
    label: "View details",
    onClick: () => {
      router.navigate(
        `/properties/${input.propertyId}/communications?campaignId=${input.campaignId}`
      );
    },
  };
  const id = `campaign-completed-${input.campaignId}`;

  if (hasCampaignDeliveryExceptions(input.status, input.failedCount)) {
    toast.warning("Delivered with exceptions", {
      action,
      description,
      id,
    });
    return;
  }

  toast.success("Notification delivered", {
    action,
    description,
    id,
  });
}
