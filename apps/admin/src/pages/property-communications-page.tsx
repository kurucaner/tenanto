import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

import { TenantEmailActiveSendBanner } from "@/components/communications/tenant-email-active-send-banner";
import { TenantEmailCampaignDetailSheet } from "@/components/communications/tenant-email-campaign-detail-sheet";
import { TenantEmailCampaignHistoryTable } from "@/components/communications/tenant-email-campaign-history-table";
import { TenantEmailCampaignHistoryToolbar } from "@/components/communications/tenant-email-campaign-history-toolbar";
import { TenantEmailComposeCard } from "@/components/communications/tenant-email-compose-card";
import { useInfiniteScrollTrigger } from "@/hooks/use-infinite-scroll-trigger";
import { useLedgerUrlSearch } from "@/hooks/use-ledger-url-search";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { useTenantEmailCampaignsInfiniteList } from "@/hooks/use-tenant-email-campaigns-infinite-list";
import { useUrlFilterState } from "@/hooks/use-url-filter-state";
import { getFilteredTableFetchState } from "@/lib/filtered-table-fetch-state";
import { isTenantEmailCampaignInProgress } from "@/lib/tenant-email-campaign-utils";
import { defineUrlFilterSchema } from "@/lib/url-search-params";
import { type TTenantEmailCampaignsListFilters } from "@/packages/shared";

const COMMUNICATIONS_URL_FILTER_SCHEMA = defineUrlFilterSchema<{ q: string }>({
  q: { defaultValue: "" },
});

function buildCampaignListFilters(q: string): TTenantEmailCampaignsListFilters {
  const qTrim = q.trim();
  return qTrim ? { q: qTrim } : {};
}

export const PropertyCommunicationsPage = memo(() => {
  const { permissions, propertyId } = usePropertyShell();
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [detailCampaignId, setDetailCampaignId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { filters, setFilter } = useUrlFilterState(COMMUNICATIONS_URL_FILTER_SCHEMA);
  const { q } = filters;
  const { onSearchInputChange: handleSearchInputChange, searchInput } = useLedgerUrlSearch(
    q,
    setFilter
  );

  const listFilters = useMemo(() => buildCampaignListFilters(q), [q]);

  const {
    campaigns,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isPending,
    meta,
  } = useTenantEmailCampaignsInfiniteList(propertyId, listFilters);

  const { isFilterRefetching, isTableInitialPending } = getFilteredTableFetchState({
    isFetching,
    isFetchingNextPage,
    isPending,
    itemCount: campaigns.length,
  });

  const scrollSentinelRef = useInfiniteScrollTrigger({
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  });

  const inProgressCampaignId = useMemo(() => {
    return (
      campaigns.find((campaign) => isTenantEmailCampaignInProgress(campaign.status))?.id ?? null
    );
  }, [campaigns]);

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

  const handleClearSearch = useCallback(() => {
    handleSearchInputChange("");
  }, [handleSearchInputChange]);

  const qTrim = q.trim();
  const activeSearchLabel = qTrim ? `Subject: ${qTrim}` : undefined;
  const countLabel = meta ? `${meta.totalCount} campaigns` : undefined;

  const toolbar = useMemo(
    () => (
      <TenantEmailCampaignHistoryToolbar
        activeSearchLabel={activeSearchLabel}
        countLabel={countLabel}
        onClearSearch={handleClearSearch}
        onSearchInputChange={handleSearchInputChange}
        searchInput={searchInput}
      />
    ),
    [activeSearchLabel, countLabel, handleClearSearch, handleSearchInputChange, searchInput]
  );

  if (!permissions.canSendTenantNotifications) {
    return <Navigate replace to={`/properties/${propertyId}`} />;
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

      {error ? (
        <p className="text-destructive text-sm">
          {error instanceof Error ? error.message : "Failed to load campaign history"}
        </p>
      ) : (
        <TenantEmailCampaignHistoryTable
          campaigns={campaigns}
          hasNextPage={Boolean(hasNextPage)}
          hasSearchQuery={qTrim.length > 0}
          isFetchingNextPage={isFetchingNextPage}
          isPending={isTableInitialPending}
          isRefreshing={isFilterRefetching}
          onSelectCampaign={handleSelectCampaign}
          scrollSentinelRef={scrollSentinelRef}
          toolbar={toolbar}
        />
      )}

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
