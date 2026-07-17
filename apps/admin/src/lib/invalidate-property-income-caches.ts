import { type QueryClient } from "@tanstack/react-query";

import { invalidatePropertyLongStayCaches } from "@/lib/invalidate-property-long-stay-caches";
import { queryKeys } from "@/lib/query-keys";

export function invalidatePropertyIncomeCaches(
  queryClient: QueryClient,
  propertyId: string,
  options: { longStayId?: string | null } = {}
): void {
  queryClient.invalidateQueries({
    queryKey: queryKeys.propertyIncomeEntriesPrefix(propertyId),
  });
  queryClient.invalidateQueries({
    queryKey: ["property", propertyId, "income-lines"],
  });
  queryClient.invalidateQueries({
    queryKey: ["property", propertyId, "short-stays"],
  });
  queryClient.invalidateQueries({
    queryKey: ["property", propertyId, "reports"],
  });
  queryClient.invalidateQueries({
    queryKey: ["portfolio", "reports"],
  });
  queryClient.invalidateQueries({
    queryKey: queryKeys.homeFinancialOverview(),
  });

  if (options.longStayId) {
    invalidatePropertyLongStayCaches(queryClient, propertyId);
  }
}
