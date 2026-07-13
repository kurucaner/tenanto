import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { longStaysApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { LEASES_LIST_MAX_LIMIT, PropertyLongStayStatus } from "@/packages/shared";

interface UsePropertyActiveLeasesOptions {
  enabled?: boolean;
}

export function usePropertyActiveLeases(
  propertyId: string,
  { enabled = true }: UsePropertyActiveLeasesOptions = {}
) {
  const query = useQuery({
    enabled,
    queryFn: () =>
      longStaysApi.list(propertyId, {
        limit: LEASES_LIST_MAX_LIMIT,
        status: PropertyLongStayStatus.ACTIVE,
      }),
    queryKey: queryKeys.propertyActiveLeases(propertyId),
  });

  const activeLeases = useMemo(() => query.data?.longStays ?? [], [query.data?.longStays]);

  return {
    activeLeases,
    isPending: query.isPending,
  };
}
