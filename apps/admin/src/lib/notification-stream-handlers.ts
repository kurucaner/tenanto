import { type QueryClient } from "@tanstack/react-query";

import { supportApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import { notifySupportAttachmentStatus } from "@/lib/support-attachment-status-registry";
import { shouldSkipSupportDetailRefresh } from "@/lib/support-chat-cache";
import {
  type INotificationStreamSupportAttachmentUpdatedData,
  type TSupportStagedUploadStatus,
} from "@/packages/shared";

function isSupportStagedUploadStatus(value: unknown): value is TSupportStagedUploadStatus {
  return value === "pending" || value === "confirmed" || value === "linked";
}

export function parseSupportAttachmentUpdatedData(
  data: Record<string, unknown>
): INotificationStreamSupportAttachmentUpdatedData | null {
  const storageKey = data.storageKey;
  const status = data.status;
  if (typeof storageKey !== "string" || !isSupportStagedUploadStatus(status)) {
    return null;
  }

  const supportRequestId = data.supportRequestId;
  return {
    status,
    storageKey,
    ...(typeof supportRequestId === "string" ? { supportRequestId } : {}),
  };
}

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

export function handleSupportAttachmentUpdated(
  queryClient: QueryClient,
  data: INotificationStreamSupportAttachmentUpdatedData,
  pathname: string
): void {
  notifySupportAttachmentStatus(data.storageKey, data.status);

  if (
    data.status === "linked" &&
    data.supportRequestId != null &&
    document.visibilityState === "visible"
  ) {
    handleSupportRequestUpdated(queryClient, data.supportRequestId, pathname);
  }
}
