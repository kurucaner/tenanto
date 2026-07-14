import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

import { TenantEmailActiveSendBanner } from "@/components/communications/tenant-email-active-send-banner";
import { TenantEmailCampaignDetailSheet } from "@/components/communications/tenant-email-campaign-detail-sheet";
import { TenantEmailCampaignHistoryTable } from "@/components/communications/tenant-email-campaign-history-table";
import { TenantEmailComposeCard } from "@/components/communications/tenant-email-compose-card";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { tenantEmailCampaignsApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { isTenantEmailCampaignInProgress } from "@/lib/tenant-email-campaign-utils";

export const PropertyCommunicationsPage = memo(() => {
  const { permissions, propertyId } = usePropertyShell();
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [detailCampaignId, setDetailCampaignId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const campaignsQuery = useQuery({
    enabled: permissions.canSendTenantNotifications,
    queryFn: () => tenantEmailCampaignsApi.list(propertyId),
    queryKey: queryKeys.propertyTenantEmailCampaigns(propertyId),
  });

  const inProgressCampaignId = useMemo(() => {
    return (
      campaignsQuery.data?.campaigns.find((campaign) =>
        isTenantEmailCampaignInProgress(campaign.status)
      )?.id ?? null
    );
  }, [campaignsQuery.data?.campaigns]);

  useEffect(() => {
    if (activeCampaignId == null && inProgressCampaignId != null) {
      setActiveCampaignId(inProgressCampaignId);
      setBannerDismissed(false);
    }
  }, [activeCampaignId, inProgressCampaignId]);

  const handleQueued = useCallback((campaignId: string) => {
    setActiveCampaignId(campaignId);
    setBannerDismissed(false);
  }, []);

  const handleSelectCampaign = useCallback((campaignId: string) => {
    setDetailCampaignId(campaignId);
    setDetailOpen(true);
  }, []);

  if (!permissions.canSendTenantNotifications) {
    return <Navigate replace to={`/properties/${propertyId}`} />;
  }

  if (campaignsQuery.isPending) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading communications…
      </div>
    );
  }

  if (campaignsQuery.isError) {
    return (
      <p className="text-destructive text-sm">
        {campaignsQuery.error instanceof Error
          ? campaignsQuery.error.message
          : "Failed to load communications"}
      </p>
    );
  }

  const showBanner = activeCampaignId != null && !bannerDismissed;

  return (
    <div className="space-y-6">
      {showBanner ? (
        <TenantEmailActiveSendBanner
          campaignId={activeCampaignId}
          onDismiss={() => setBannerDismissed(true)}
          propertyId={propertyId}
        />
      ) : null}

      <TenantEmailComposeCard onQueued={handleQueued} propertyId={propertyId} />

      <TenantEmailCampaignHistoryTable
        campaigns={campaignsQuery.data?.campaigns ?? []}
        onSelectCampaign={handleSelectCampaign}
      />

      <TenantEmailCampaignDetailSheet
        campaignId={detailCampaignId}
        onOpenChange={setDetailOpen}
        open={detailOpen}
        propertyId={propertyId}
      />
    </div>
  );
});
PropertyCommunicationsPage.displayName = "PropertyCommunicationsPage";
