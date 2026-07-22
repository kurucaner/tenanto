import { ChevronRight, Mail } from "lucide-react";
import { memo } from "react";

import { HomeColumnPanel, HomeColumnRow } from "@/components/home/home-column-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHomeRecentCommunications } from "@/hooks/use-home-recent-communications";
import { useHomeWorkspaceProperties } from "@/hooks/use-home-workspace-properties";
import {
  buildHomeCommunicationsCampaignHref,
  isHomeRecentTenantEmailCampaignInProgress,
} from "@/lib/home-recent-communications-utils";
import { buildPropertyShellTabPath } from "@/lib/property-shell-tab-navigation";
import { getTenantEmailCampaignStatusLabel } from "@/lib/tenant-email-campaign-utils";
import { type IHomeRecentTenantEmailCampaign } from "@/packages/shared";

const COMMUNICATIONS_EMPTY_MESSAGE = "Send something new";
const COMMUNICATIONS_EMPTY_TOOLTIP = "Create a property first to send an announcement.";
const COMMUNICATIONS_TAB = { label: "Announcements", path: "communications" } as const;

const HomeCommunicationRow = memo(({ campaign }: { campaign: IHomeRecentTenantEmailCampaign }) => {
  const showStatusHint = isHomeRecentTenantEmailCampaignInProgress(campaign.status);

  return (
    <HomeColumnRow href={buildHomeCommunicationsCampaignHref(campaign.propertyId, campaign.id)}>
      <Mail className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">
        <span className="text-muted-foreground">{campaign.propertyName}</span>
        <span className="text-muted-foreground/70"> / </span>
        <span>{campaign.subject}</span>
      </span>
      {showStatusHint ? (
        <span className="shrink-0 text-muted-foreground text-xs">
          {getTenantEmailCampaignStatusLabel(campaign.status)}
        </span>
      ) : null}
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
    </HomeColumnRow>
  );
});
HomeCommunicationRow.displayName = "HomeCommunicationRow";

export const HomeCommunicationsColumn = memo(() => {
  const { campaigns, error, hasSendAccess, isAccessResolved, isError, isPending, refetch } =
    useHomeRecentCommunications();
  const { listItems } = useHomeWorkspaceProperties();
  const firstProperty = listItems[0];

  if (!isAccessResolved || !hasSendAccess) {
    return null;
  }

  if (isPending) {
    return (
      <HomeColumnPanel title="Announcements">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="flex min-h-11 items-center gap-2.5 px-3 py-2" key={index}>
            <Skeleton className="size-4 shrink-0 rounded-sm" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </HomeColumnPanel>
    );
  }

  if (isError && campaigns.length === 0) {
    return (
      <HomeColumnPanel title="Announcements">
        <div className="flex flex-col gap-2 px-3 py-4">
          <p className="text-destructive text-xs">
            {error instanceof Error ? error.message : "Could not load tenant emails."}
          </p>
          <Button onClick={() => refetch()} size="sm" type="button" variant="outline">
            Try again
          </Button>
        </div>
      </HomeColumnPanel>
    );
  }

  if (campaigns.length === 0) {
    if (firstProperty) {
      return (
        <HomeColumnPanel
          emptyHref={buildPropertyShellTabPath(firstProperty.id, COMMUNICATIONS_TAB)}
          emptyMessage={COMMUNICATIONS_EMPTY_MESSAGE}
          title="Announcements"
        />
      );
    }

    return (
      <HomeColumnPanel
        emptyMessage={COMMUNICATIONS_EMPTY_MESSAGE}
        emptyTooltip={COMMUNICATIONS_EMPTY_TOOLTIP}
        title="Announcements"
      />
    );
  }

  return (
    <HomeColumnPanel title="Announcements">
      {campaigns.map((campaign) => (
        <HomeCommunicationRow campaign={campaign} key={campaign.id} />
      ))}
    </HomeColumnPanel>
  );
});
HomeCommunicationsColumn.displayName = "HomeCommunicationsColumn";
