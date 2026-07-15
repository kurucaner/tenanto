import { type QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

export async function invalidateTenantPortalCaches(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.leases() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.pendingInvites() }),
  ]);
}
