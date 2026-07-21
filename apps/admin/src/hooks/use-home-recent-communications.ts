import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useHomeWorkspaceProperties } from "@/hooks/use-home-workspace-properties";
import { homeApi } from "@/lib/api-client";
import { hasHomeRecentCommunicationsSendAccess } from "@/lib/home-recent-communications-utils";
import { PROPERTIES_LIST_STALE_TIME_MS } from "@/lib/properties-list-constants";
import { queryKeys } from "@/lib/query-keys";
import { HOME_RECENT_TENANT_EMAIL_CAMPAIGNS_LIMIT, UserType } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

export function useHomeRecentCommunications() {
  const user = useAuthStore((state) => state.user);
  const { isPending: isPropertiesPending, listItems } = useHomeWorkspaceProperties();
  const isAdmin = user?.userType === UserType.ADMIN;
  const isAccessResolved = isAdmin || !isPropertiesPending;
  const hasSendAccess = useMemo(
    () => hasHomeRecentCommunicationsSendAccess(listItems, user),
    [listItems, user]
  );

  const query = useQuery({
    enabled: isAccessResolved && hasSendAccess,
    queryFn: () => homeApi.recentTenantEmailCampaigns(HOME_RECENT_TENANT_EMAIL_CAMPAIGNS_LIMIT),
    queryKey: queryKeys.homeRecentTenantEmailCampaigns(),
    staleTime: PROPERTIES_LIST_STALE_TIME_MS,
  });

  return {
    campaigns: query.data?.campaigns ?? [],
    error: query.error,
    hasSendAccess,
    isAccessResolved,
    isError: query.isError,
    isPending: query.isPending,
    refetch: query.refetch,
  };
}
