import { type QueryClient } from "@tanstack/react-query";

import { adminQueryKeys } from "@/lib/query-keys";

export function invalidatePropertyUnitCaches(queryClient: QueryClient, propertyId: string) {
  void queryClient.invalidateQueries({
    queryKey: adminQueryKeys.propertyUnits(propertyId),
  });
  void queryClient.invalidateQueries({
    queryKey: adminQueryKeys.propertyUnitsPicker(propertyId),
  });
  void queryClient.invalidateQueries({
    queryKey: adminQueryKeys.propertyDetail(propertyId),
  });
}
