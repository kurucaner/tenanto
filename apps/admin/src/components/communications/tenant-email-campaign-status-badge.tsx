import { type VariantProps } from "class-variance-authority";
import { memo } from "react";

import { Badge, type badgeVariants } from "@/components/ui/badge";
import { getTenantEmailCampaignStatusLabel } from "@/lib/tenant-email-campaign-utils";
import {
  type ITenantEmailCampaign,
  TenantEmailCampaignStatus,
  type TTenantEmailCampaignStatus,
} from "@/packages/shared";

type TBadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

function getStatusBadgeVariant(status: TTenantEmailCampaignStatus): TBadgeVariant {
  switch (status) {
    case TenantEmailCampaignStatus.COMPLETED:
      return "secondary";
    case TenantEmailCampaignStatus.COMPLETED_WITH_ERRORS:
      return "outline";
    case TenantEmailCampaignStatus.FAILED:
      return "destructive";
    case TenantEmailCampaignStatus.SENDING:
      return "default";
    case TenantEmailCampaignStatus.QUEUED:
    default:
      return "outline";
  }
}

export const TenantEmailCampaignStatusBadge = memo(
  ({ status }: { status: TTenantEmailCampaignStatus | ITenantEmailCampaign["status"] }) => (
    <Badge variant={getStatusBadgeVariant(status)}>
      {getTenantEmailCampaignStatusLabel(status)}
    </Badge>
  )
);
TenantEmailCampaignStatusBadge.displayName = "TenantEmailCampaignStatusBadge";
