import { LATEST_RELEASE_ID } from "@/config/release-notes";
import { APP_SLUG } from "@/packages/shared";

export const RELEASE_NOTES_SEEN_STORAGE_KEY = `${APP_SLUG}-admin-release-notes-seen`;

const seenReleaseListeners = new Set<() => void>();
let storageListenerAttached = false;

function broadcastSeenRelease() {
  for (const listener of seenReleaseListeners) {
    listener();
  }
}

function onSeenReleaseStorageEvent(event: StorageEvent) {
  if (event.key !== RELEASE_NOTES_SEEN_STORAGE_KEY) return;
  broadcastSeenRelease();
}

export function subscribeSeenRelease(onStoreChange: () => void): () => void {
  seenReleaseListeners.add(onStoreChange);
  if (
    typeof globalThis !== "undefined" &&
    "addEventListener" in globalThis &&
    !storageListenerAttached
  ) {
    globalThis.addEventListener("storage", onSeenReleaseStorageEvent);
    storageListenerAttached = true;
  }
  return () => {
    seenReleaseListeners.delete(onStoreChange);
    if (
      seenReleaseListeners.size === 0 &&
      storageListenerAttached &&
      typeof globalThis !== "undefined" &&
      "removeEventListener" in globalThis
    ) {
      globalThis.removeEventListener("storage", onSeenReleaseStorageEvent);
      storageListenerAttached = false;
    }
  };
}

export function readLastSeenReleaseId(): string | null {
  if (globalThis.window === undefined) return null;
  try {
    return globalThis.window.localStorage.getItem(RELEASE_NOTES_SEEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function markReleaseNotesSeen(releaseId: string | null = LATEST_RELEASE_ID): void {
  if (!releaseId || globalThis.window === undefined) return;
  try {
    globalThis.window.localStorage.setItem(RELEASE_NOTES_SEEN_STORAGE_KEY, releaseId);
    broadcastSeenRelease();
  } catch {
    /* private mode etc. */
  }
}

export function hasUnreadReleaseNotes(): boolean {
  if (!LATEST_RELEASE_ID) return false;
  return readLastSeenReleaseId() !== LATEST_RELEASE_ID;
}
