import { type QueryClient } from "@tanstack/react-query";

import { invalidatePropertyUnitCaches } from "@/lib/invalidate-property-unit-caches";
import { adminQueryKeys } from "@/lib/query-keys";

export function invalidatePropertyLongStayCaches(queryClient: QueryClient, propertyId: string) {
  queryClient.invalidateQueries({
    queryKey: ["property", propertyId, "long-stays"],
  });
  queryClient.invalidateQueries({
    queryKey: adminQueryKeys.propertyActiveLeases(propertyId),
  });
  invalidatePropertyUnitCaches(queryClient, propertyId);
}
