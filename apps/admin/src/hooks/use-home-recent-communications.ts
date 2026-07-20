import { useQuery } from "@tanstack/react-query";

import { homeApi } from "@/lib/api-client";
import { PROPERTIES_LIST_STALE_TIME_MS } from "@/lib/properties-list-constants";
import { queryKeys } from "@/lib/query-keys";
import { HOME_RECENT_TENANT_EMAIL_CAMPAIGNS_LIMIT } from "@/packages/shared";

export function useHomeRecentCommunications() {
  const query = useQuery({
    queryFn: () => homeApi.recentTenantEmailCampaigns(HOME_RECENT_TENANT_EMAIL_CAMPAIGNS_LIMIT),
    queryKey: queryKeys.homeRecentTenantEmailCampaigns(),
    staleTime: PROPERTIES_LIST_STALE_TIME_MS,
  });

  return {
    campaigns: query.data?.campaigns ?? [],
    error: query.error,
    isError: query.isError,
    isPending: query.isPending,
    refetch: query.refetch,
  };
}
