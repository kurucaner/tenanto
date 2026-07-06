import { type QueryClient } from "@tanstack/react-query";

import { adminQueryKeys } from "@/lib/query-keys";
import type { IPropertyReservationsListQuery } from "@/packages/shared";

export function invalidatePropertyReservationCaches(
  queryClient: QueryClient,
  propertyId: string,
  filters?: IPropertyReservationsListQuery
) {
  void queryClient.invalidateQueries({
    queryKey: adminQueryKeys.propertyReservations(propertyId, filters ?? {}),
  });
  void queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === "admin" &&
      query.queryKey[1] === "property" &&
      query.queryKey[2] === propertyId &&
      query.queryKey[3] === "reservations",
  });
}
