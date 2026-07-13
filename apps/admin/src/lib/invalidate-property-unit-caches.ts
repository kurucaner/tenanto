import { type QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

export function invalidatePropertyUnitCaches(queryClient: QueryClient, propertyId: string) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.propertyUnits(propertyId),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.propertyUnitsPicker(propertyId),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.propertyDetail(propertyId),
  });
}
