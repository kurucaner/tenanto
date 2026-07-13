import { useQuery } from "@tanstack/react-query";
import { Loader2, MailCheck, MailWarning } from "lucide-react";
import { memo, useMemo } from "react";

import { TenantEmailCampaignStatusBadge } from "@/components/communications/tenant-email-campaign-status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { tenantEmailCampaignsApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  getTenantEmailCampaignProcessedCount,
  isTenantEmailCampaignInProgress,
  isTenantEmailCampaignTerminal,
} from "@/lib/tenant-email-campaign-utils";
import { TenantEmailCampaignStatus } from "@/packages/shared";

interface ITenantEmailActiveSendBannerProps {
  campaignId: string;
  onDismiss?: () => void;
  propertyId: string;
}

export const TenantEmailActiveSendBanner = memo(
  ({ campaignId, onDismiss, propertyId }: ITenantEmailActiveSendBannerProps) => {
    const detailQuery = useQuery({
      queryFn: () => tenantEmailCampaignsApi.get(propertyId, campaignId),
      queryKey: queryKeys.propertyTenantEmailCampaign(propertyId, campaignId),
    });

    const campaign = detailQuery.data?.campaign;
    const progress = useMemo(() => {
      if (campaign == null) {
        return 0;
      }
      if (campaign.recipientCount === 0) {
        return 100;
      }
      return Math.round(
        (getTenantEmailCampaignProcessedCount(campaign) / campaign.recipientCount) * 100
      );
    }, [campaign]);

    if (detailQuery.isPending || campaign == null) {
      return (
        <Card>
          <CardContent className="flex items-center gap-2 py-4 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading campaign progress…
          </CardContent>
        </Card>
      );
    }

    const inProgress = isTenantEmailCampaignInProgress(campaign.status);
    const isComplete = isTenantEmailCampaignTerminal(campaign.status);
    const hasErrors =
      campaign.status === TenantEmailCampaignStatus.COMPLETED_WITH_ERRORS ||
      campaign.failedCount > 0;

    return (
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {inProgress ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : hasErrors ? (
                  <MailWarning className="size-4 text-destructive" />
                ) : (
                  <MailCheck className="size-4 text-primary" />
                )}
                <p className="font-medium text-sm">
                  {inProgress
                    ? "Sending tenant notification"
                    : hasErrors
                      ? "Notification finished with errors"
                      : "Notification sent"}
                </p>
                <TenantEmailCampaignStatusBadge status={campaign.status} />
              </div>
              <p className="text-muted-foreground text-sm">{campaign.subject}</p>
            </div>
            {isComplete && onDismiss != null ? (
              <button
                className="text-muted-foreground text-sm hover:text-foreground"
                onClick={onDismiss}
                type="button"
              >
                Dismiss
              </button>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              {campaign.sentCount} sent · {campaign.failedCount} failed · {campaign.skippedCount}{" "}
              skipped · {campaign.recipientCount} total
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
);
TenantEmailActiveSendBanner.displayName = "TenantEmailActiveSendBanner";
