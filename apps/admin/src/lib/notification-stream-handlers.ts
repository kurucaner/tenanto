import { type QueryClient } from "@tanstack/react-query";

import { supportApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import { shouldSkipSupportDetailRefresh } from "@/lib/support-chat-cache";

export function handleSupportRequestUpdated(
  queryClient: QueryClient,
  supportRequestId: string,
  pathname: string
): void {
  if (document.visibilityState !== "visible") return;
  if (pathname !== `/support-requests/${supportRequestId}`) return;
  if (shouldSkipSupportDetailRefresh(supportRequestId)) return;

  void queryClient.fetchQuery({
    queryFn: () => supportApi.get(supportRequestId),
    queryKey: adminQueryKeys.supportRequest(supportRequestId),
    staleTime: 0,
  });
}
