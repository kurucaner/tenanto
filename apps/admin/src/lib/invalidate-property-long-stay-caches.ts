import { type QueryClient } from "@tanstack/react-query";

import { invalidatePropertyUnitCaches } from "@/lib/invalidate-property-unit-caches";
import { queryKeys } from "@/lib/query-keys";

export function invalidatePropertyLongStayCaches(queryClient: QueryClient, propertyId: string) {
  queryClient.invalidateQueries({
    queryKey: ["property", propertyId, "long-stays"],
  });
  queryClient.invalidateQueries({
    queryKey: queryKeys.propertyActiveLeases(propertyId),
  });
  invalidatePropertyUnitCaches(queryClient, propertyId);
}

export function invalidatePropertyLongStayPortalCaches(
  queryClient: QueryClient,
  propertyId: string,
  longStayId: string
) {
  queryClient.invalidateQueries({
    queryKey: queryKeys.propertyLongStayPortalAccess(propertyId, longStayId),
  });
}
