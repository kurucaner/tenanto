import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { longStaysApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import { LEASES_LIST_MAX_LIMIT, PropertyLongStayStatus } from "@/packages/shared";

export function usePropertyActiveLeases(propertyId: string) {
  const query = useQuery({
    queryFn: () =>
      longStaysApi.list(propertyId, {
        limit: LEASES_LIST_MAX_LIMIT,
        status: PropertyLongStayStatus.ACTIVE,
      }),
    queryKey: adminQueryKeys.propertyLongStays(propertyId, {
      status: PropertyLongStayStatus.ACTIVE,
    }),
  });

  const activeLeases = useMemo(() => query.data?.longStays ?? [], [query.data?.longStays]);

  return {
    activeLeases,
    isPending: query.isPending,
  };
}
