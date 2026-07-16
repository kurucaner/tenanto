import { type QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

export async function invalidateTenantPortalCaches(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.leases() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.pendingInvites() }),
  ]);
}

export async function invalidateTenantLeasePaymentCaches(
  queryClient: QueryClient,
  leaseId: string
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.lease(leaseId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.leaseBalance(leaseId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.leases() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.rentSummary() }),
  ]);
}
