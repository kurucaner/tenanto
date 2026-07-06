const LOCAL_UPDATE_TTL_MS = 3_000;

interface ILocalSupportDetailUpdate {
  at: number;
  lastMessageId: string;
}

const localUpdates = new Map<string, ILocalSupportDetailUpdate>();

export function markSupportDetailLocallyUpdated(
  supportRequestId: string,
  lastMessageId: string
): void {
  localUpdates.set(supportRequestId, {
    at: Date.now(),
    lastMessageId,
  });
}

export function shouldSkipSupportDetailRefresh(supportRequestId: string): boolean {
  const entry = localUpdates.get(supportRequestId);
  if (entry == null) return false;

  if (Date.now() - entry.at > LOCAL_UPDATE_TTL_MS) {
    localUpdates.delete(supportRequestId);
    return false;
  }

  return true;
}

export function clearSupportDetailLocalUpdate(supportRequestId: string): void {
  localUpdates.delete(supportRequestId);
}
