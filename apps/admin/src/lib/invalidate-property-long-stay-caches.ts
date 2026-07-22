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

/** Lease detail only — exact match so portal-access is not invalidated by prefix. */
export function invalidatePropertyLongStayDetailQuery(
  queryClient: QueryClient,
  propertyId: string,
  longStayId: string
) {
  queryClient.invalidateQueries({
    exact: true,
    queryKey: queryKeys.propertyLongStay(propertyId, longStayId),
  });
}

/** After income changes that affect lease detail (deposit balance, rent schedule). */
export function invalidatePropertyLongStayAfterIncomeChange(
  queryClient: QueryClient,
  propertyId: string,
  longStayId: string
) {
  invalidatePropertyLongStayCaches(queryClient, propertyId);
  invalidatePropertyLongStayDetailQuery(queryClient, propertyId, longStayId);
}

export function invalidatePropertyLongStayDetailCaches(
  queryClient: QueryClient,
  propertyId: string,
  longStayId: string
) {
  invalidatePropertyLongStayDetailQuery(queryClient, propertyId, longStayId);
  invalidatePropertyLongStayPortalCaches(queryClient, propertyId, longStayId);
}
