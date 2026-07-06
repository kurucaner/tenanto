import { type QueryClient } from "@tanstack/react-query";

import { adminQueryKeys } from "@/lib/query-keys";

export function handleSupportRequestUpdated(
  queryClient: QueryClient,
  supportRequestId: string,
  pathname: string
): void {
  if (document.visibilityState !== "visible") return;
  if (pathname !== `/support-requests/${supportRequestId}`) return;
  queryClient.invalidateQueries({ queryKey: adminQueryKeys.supportRequest(supportRequestId) });
}
