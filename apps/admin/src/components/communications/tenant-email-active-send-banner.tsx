import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Mail, TriangleAlert, X } from "lucide-react";
import { memo, type ReactNode, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { tenantEmailCampaignsApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  getTenantEmailCampaignProcessedCount,
  isTenantEmailCampaignInProgress,
  isTenantEmailCampaignTerminal,
} from "@/lib/tenant-email-campaign-utils";
import { cn } from "@/lib/utils";
import { TenantEmailCampaignStatus, type TTenantEmailCampaignStatus } from "@/packages/shared";

interface ITenantEmailActiveSendBannerProps {
  campaignId: string;
  onDismiss?: () => void;
  propertyId: string;
}

interface ICampaignPostmarkProps {
  hasErrors: boolean;
  inProgress: boolean;
  progress: number;
}

function getPostmarkIcon(inProgress: boolean, hasErrors: boolean): ReactNode {
  if (inProgress) {
    return <Mail className="size-3.5 text-primary" />;
  }
  if (hasErrors) {
    return <TriangleAlert className="size-3.5 text-destructive" />;
  }
  return <Check className="size-4 text-primary" strokeWidth={2.5} />;
}

const CampaignPostmark = memo(
  ({ hasErrors, inProgress, progress }: ICampaignPostmarkProps) => {
    const ringColor = hasErrors ? "var(--destructive)" : "var(--primary)";

    return (
      <div
        aria-hidden
        className="relative grid size-10 shrink-0 place-items-center rounded-full motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-75 motion-safe:duration-500"
        style={{
          background: `conic-gradient(${ringColor} ${progress}%, color-mix(in oklab, var(--muted) 82%, transparent) 0)`,
        }}
      >
        <div className="grid size-8 place-items-center rounded-full bg-card shadow-sm">
          {getPostmarkIcon(inProgress, hasErrors)}
        </div>

        {inProgress ? (
          <div className="absolute inset-0 motion-safe:animate-spin motion-reduce:hidden [animation-duration:2.4s]">
            <span className="absolute left-1/2 top-[-2px] size-1.5 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
          </div>
        ) : (
          <span className="absolute inset-[-4px] rounded-full border border-primary/25 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-50 motion-safe:duration-700" />
        )}
      </div>
    );
  }
);
CampaignPostmark.displayName = "CampaignPostmark";

function getPostmarkTitle(
  status: TTenantEmailCampaignStatus,
  hasErrors: boolean,
  sentCount: number
): string {
  if (isTenantEmailCampaignInProgress(status)) {
    return "Sending";
  }
  if (hasErrors) {
    return "Delivered with exceptions";
  }
  return `Delivered to ${sentCount}`;
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
      return Math.min(
        100,
        Math.round(
          (getTenantEmailCampaignProcessedCount(campaign) / campaign.recipientCount) * 100
        )
      );
    }, [campaign]);

    if (detailQuery.isPending || campaign == null) {
      return (
        <div className="flex h-16 items-center gap-3 overflow-hidden rounded-xl border bg-card px-3.5 shadow-sm">
          <div className="grid size-10 shrink-0 place-items-center rounded-full border bg-muted/50">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
          </div>
          <p className="text-muted-foreground text-sm">Preparing live dispatch…</p>
        </div>
      );
    }

    const inProgress = isTenantEmailCampaignInProgress(campaign.status);
    const isComplete = isTenantEmailCampaignTerminal(campaign.status);
    const hasErrors =
      campaign.status === TenantEmailCampaignStatus.COMPLETED_WITH_ERRORS ||
      campaign.status === TenantEmailCampaignStatus.FAILED ||
      campaign.failedCount > 0;
    const processedCount = getTenantEmailCampaignProcessedCount(campaign);
    const title = getPostmarkTitle(campaign.status, hasErrors, campaign.sentCount);

    return (
      <output className="relative isolate block h-16 overflow-hidden rounded-xl border bg-card shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-500">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_4%_50%,color-mix(in_oklab,var(--primary)_10%,transparent),transparent_28%)]" />

        <div className="relative flex h-full items-center gap-3 px-3.5 pb-1">
          <CampaignPostmark hasErrors={hasErrors} inProgress={inProgress} progress={progress} />

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="font-medium text-sm">{title}</p>
              {inProgress ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                  <span className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
                  <span>Live</span>
                </span>
              ) : null}
            </div>
            <p className="truncate text-xs text-muted-foreground">{campaign.subject}</p>
          </div>

          <div className="shrink-0 text-right">
            <p className="font-mono text-sm font-semibold tabular-nums">
              {processedCount}
              <span className="text-muted-foreground font-normal"> / {campaign.recipientCount}</span>
            </p>
            <p className="hidden text-[10px] text-muted-foreground sm:block">
              {campaign.sentCount} sent
              {campaign.failedCount > 0 ? ` · ${campaign.failedCount} failed` : ""}
            </p>
          </div>

          {isComplete && onDismiss != null ? (
            <Button
              aria-label="Dismiss campaign status"
              className="text-muted-foreground"
              onClick={onDismiss}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <X />
            </Button>
          ) : null}
        </div>

        <progress
          aria-label="Campaign delivery progress"
          className="sr-only"
          max={100}
          value={progress}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1 bg-muted"
        >
          <div
            className={cn(
              "relative h-full transition-[width] duration-500 ease-out motion-reduce:transition-none",
              hasErrors ? "bg-destructive" : "bg-primary"
            )}
            style={{ width: `${progress}%` }}
          >
            {inProgress ? (
              <span className="absolute right-0 top-1/2 size-2 -translate-y-1/2 translate-x-1/2 rounded-full bg-primary shadow-[0_0_9px_var(--primary)]" />
            ) : null}
          </div>
        </div>
      </output>
    );
  }
);
TenantEmailActiveSendBanner.displayName = "TenantEmailActiveSendBanner";
