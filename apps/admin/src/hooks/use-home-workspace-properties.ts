import { useQuery } from "@tanstack/react-query";

import { useRecentProperties } from "@/hooks/use-recent-properties";
import { propertiesApi } from "@/lib/api-client";
import {
  HOME_WORKSPACE_PROPERTIES_LIST_LIMIT,
  mergeHomeWorkspaceProperties,
} from "@/lib/home-workspace-properties-utils";
import { PROPERTIES_LIST_STALE_TIME_MS } from "@/lib/properties-list-constants";
import { queryKeys } from "@/lib/query-keys";

export {
  HOME_WORKSPACE_PROPERTIES_LIST_LIMIT,
  HOME_WORKSPACE_PROPERTIES_MAX,
  mergeHomeWorkspaceProperties,
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

  return {
    isError: listQuery.isError,
    isPending: listQuery.isPending,
    listItems,
    properties,
    recentEntries,
  };
}
