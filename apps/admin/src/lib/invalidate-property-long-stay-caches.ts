import { type QueryClient } from "@tanstack/react-query";

import { invalidatePropertyUnitCaches } from "@/lib/invalidate-property-unit-caches";

export function invalidatePropertyLongStayCaches(queryClient: QueryClient, propertyId: string) {
  queryClient.invalidateQueries({
    queryKey: ["property", propertyId, "long-stays"],
  });
  invalidatePropertyUnitCaches(queryClient, propertyId);
}
