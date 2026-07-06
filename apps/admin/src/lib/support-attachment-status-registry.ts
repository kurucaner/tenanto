import { type TSupportStagedUploadStatus } from "@/packages/shared";

type SupportAttachmentStatusListener = (status: TSupportStagedUploadStatus) => void;

const listenersByKey = new Map<string, Set<SupportAttachmentStatusListener>>();

export function subscribeSupportAttachmentStatus(
  storageKey: string,
  listener: SupportAttachmentStatusListener
): () => void {
  const listeners = listenersByKey.get(storageKey) ?? new Set<SupportAttachmentStatusListener>();
  listeners.add(listener);
  listenersByKey.set(storageKey, listeners);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      listenersByKey.delete(storageKey);
    }
  };
}

export function notifySupportAttachmentStatus(
  storageKey: string,
  status: TSupportStagedUploadStatus
): void {
  const listeners = listenersByKey.get(storageKey);
  if (listeners == null) return;

  for (const listener of listeners) {
    listener(status);
  }
}
