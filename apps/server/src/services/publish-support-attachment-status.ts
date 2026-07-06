import { type TSupportStagedUploadStatus } from "@/packages/shared";

import { notificationStreamHub } from "./notification-stream-hub";

export function publishSupportAttachmentStatus(params: {
  log?: { error: (err: unknown) => void };
  status: TSupportStagedUploadStatus;
  storageKey: string;
  supportRequestId?: string;
  userId: string;
}): void {
  notificationStreamHub
    .publishSupportAttachmentUpdated({
      status: params.status,
      storageKey: params.storageKey,
      supportRequestId: params.supportRequestId,
      userId: params.userId,
    })
    .catch((err) => {
      params.log?.error(err);
    });
}
