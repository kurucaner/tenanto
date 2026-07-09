import { type QueryClient } from "@tanstack/react-query";

import { adminQueryKeys } from "@/lib/query-keys";
import type { IPropertyReservationsListQuery } from "@/packages/shared";

export function invalidatePropertyReservationCaches(
  queryClient: QueryClient,
  propertyId: string,
  filters?: IPropertyReservationsListQuery
) {
  queryClient.invalidateQueries({
    queryKey: adminQueryKeys.propertyReservations(propertyId, filters ?? {}),
  });
  queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[1] === "property" &&
      query.queryKey[2] === propertyId &&
      query.queryKey[3] === "reservations",
  });
}
