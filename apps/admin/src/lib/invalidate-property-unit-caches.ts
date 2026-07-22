import { type QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

export function invalidatePropertyUnitCaches(queryClient: QueryClient, propertyId: string) {
  queryClient.invalidateQueries({
    queryKey: queryKeys.propertyUnits(propertyId),
  });
  queryClient.invalidateQueries({
    queryKey: queryKeys.propertyUnitsPicker(propertyId),
  });
  // exact: true — propertyDetail is ["property", id]; without it every property-* query refetches.
  queryClient.invalidateQueries({
    exact: true,
    queryKey: queryKeys.propertyDetail(propertyId),
  });
}
