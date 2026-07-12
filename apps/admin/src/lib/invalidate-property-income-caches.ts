import { type QueryClient } from "@tanstack/react-query";

import { adminQueryKeys } from "@/lib/query-keys";

export function invalidatePropertyIncomeCaches(
  queryClient: QueryClient,
  propertyId: string,
  options: { longStayId?: string | null } = {}
): void {
  queryClient.invalidateQueries({
    queryKey: ["property", propertyId, "income-lines"],
  });
  queryClient.invalidateQueries({
    queryKey: ["property", propertyId, "reservations"],
  });
  queryClient.invalidateQueries({
    queryKey: ["property", propertyId, "reports"],
  });
  queryClient.invalidateQueries({
    queryKey: ["portfolio", "reports"],
  });
  queryClient.invalidateQueries({
    queryKey: adminQueryKeys.homeFinancialOverview(),
  });

  if (options.longStayId) {
    queryClient.invalidateQueries({
      queryKey: adminQueryKeys.propertyLongStay(propertyId, options.longStayId),
    });
  }
}
