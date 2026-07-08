import { type QueryClient } from "@tanstack/react-query";

import { supportApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import { notifySupportAttachmentStatus } from "@/lib/support-attachment-status-registry";
import { shouldSkipSupportDetailRefresh } from "@/lib/support-chat-cache";
import {
  type INotificationStreamSupportAttachmentUpdatedData,
  type IUserNotification,
  type TSupportStagedUploadStatus,
  UserType,
} from "@/packages/shared";

function isPropertyMembershipNotification(
  type: string
): type is "property_member_added" | "property_member_removed" {
  return type === "property_member_added" || type === "property_member_removed";
}

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

export function handlePropertyMembershipNotification(
  queryClient: QueryClient,
  notification: IUserNotification
): void {
  if (!isPropertyMembershipNotification(notification.type)) {
    return;
  }

  queryClient.invalidateQueries({ queryKey: ["admin", "properties"] });

  if (notification.resourceId != null) {
    queryClient.invalidateQueries({
      queryKey: adminQueryKeys.propertyDetail(notification.resourceId),
    });
  }
}

export function handleSupportRequestUpdated(
  queryClient: QueryClient,
  supportRequestId: string,
  pathname: string,
  userType: UserType
): void {
  if (document.visibilityState !== "visible") return;

  if (userType === UserType.ADMIN) {
    queryClient.invalidateQueries({ queryKey: ["admin", "support-requests"] });
  } else {
    queryClient.invalidateQueries({ queryKey: ["support", "list"] });
  }

  if (pathname !== `/support-requests/${supportRequestId}`) return;
  if (shouldSkipSupportDetailRefresh(supportRequestId)) return;

  queryClient.fetchQuery({
    queryFn: () => supportApi.get(supportRequestId),
    queryKey: adminQueryKeys.supportRequest(supportRequestId),
    staleTime: 0,
  });
}

export function handleSupportAttachmentUpdated(
  queryClient: QueryClient,
  data: INotificationStreamSupportAttachmentUpdatedData,
  pathname: string,
  userType: UserType
): void {
  notifySupportAttachmentStatus(data.storageKey, data.status);

  if (
    data.status === "linked" &&
    data.supportRequestId != null &&
    document.visibilityState === "visible"
  ) {
    handleSupportRequestUpdated(queryClient, data.supportRequestId, pathname, userType);
  }
}
