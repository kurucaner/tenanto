import { useQuery } from "@tanstack/react-query";

import { useRecentProperties } from "@/hooks/use-recent-properties";
import { propertiesApi } from "@/lib/api-client";
import {
  HOME_WORKSPACE_PROPERTIES_LIST_LIMIT,
  mergeHomeWorkspaceProperties,
  partitionRecentEntriesByAccessibleList,
} from "@/lib/home-workspace-properties-utils";
import { PROPERTIES_LIST_STALE_TIME_MS } from "@/lib/properties-list-constants";
import { queryKeys } from "@/lib/query-keys";
import { type IRecentProperty } from "@/lib/recent-properties-storage";

export {
  HOME_WORKSPACE_PROPERTIES_LIST_LIMIT,
  HOME_WORKSPACE_PROPERTIES_MAX,
  mergeHomeWorkspaceProperties,
  partitionRecentEntriesByAccessibleList,
} from "@/lib/home-workspace-properties-utils";

export function useHomeWorkspaceProperties() {
  const recentEntries = useRecentProperties();

  const listQuery = useQuery({
    queryFn: () =>
      propertiesApi.list({
        limit: HOME_WORKSPACE_PROPERTIES_LIST_LIMIT,
      }),
    queryKey: queryKeys.homeWorkspace(),
    staleTime: PROPERTIES_LIST_STALE_TIME_MS,
  });

  const listItems = listQuery.data?.items ?? [];
  const properties = mergeHomeWorkspaceProperties(recentEntries, listItems);
  const { accessibleRecentEntries, staleRecentEntries } = listQuery.isSuccess
    ? partitionRecentEntriesByAccessibleList(recentEntries, listItems)
    : { accessibleRecentEntries: recentEntries, staleRecentEntries: [] as IRecentProperty[] };

  return {
    accessibleRecentEntries,
    error: listQuery.error,
    isError: listQuery.isError,
    isPending: listQuery.isPending,
    listItems,
    properties,
    recentEntries,
    refetch: listQuery.refetch,
    staleRecentEntries,
  };
}
