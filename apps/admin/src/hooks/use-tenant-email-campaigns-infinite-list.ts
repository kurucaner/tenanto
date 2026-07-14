import { type InfiniteData, keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { tenantEmailCampaignsApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  type ITenantEmailCampaignListResponse,
  TENANT_EMAIL_CAMPAIGNS_LIST_LIMIT,
  type TTenantEmailCampaignsListFilters,
} from "@/packages/shared";

export type { TTenantEmailCampaignsListFilters };

export function useTenantEmailCampaignsInfiniteList(
  propertyId: string,
  filters: TTenantEmailCampaignsListFilters
) {
  const listFilters = useMemo(
    () => ({
      ...filters,
      limit: TENANT_EMAIL_CAMPAIGNS_LIST_LIMIT,
    }),
    [filters]
  );

  const query = useInfiniteQuery<
    ITenantEmailCampaignListResponse,
    Error,
    InfiniteData<ITenantEmailCampaignListResponse>,
    ReturnType<typeof queryKeys.propertyTenantEmailCampaigns>,
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam }) =>
      tenantEmailCampaignsApi.list(propertyId, { ...listFilters, cursor: pageParam }),
    queryKey: queryKeys.propertyTenantEmailCampaigns(propertyId, filters),
  });

  const campaigns = useMemo(
    () => query.data?.pages.flatMap((page) => page.campaigns) ?? [],
    [query.data?.pages]
  );

  const meta = query.data?.pages[0]?.meta;

  return {
    campaigns,
    error: query.error,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isError: query.isError,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isPending: query.isPending,
    meta,
  };
}
