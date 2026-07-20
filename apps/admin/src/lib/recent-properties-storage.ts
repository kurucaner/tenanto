import { APP_SLUG } from "@/packages/shared";

export const RECENT_PROPERTIES_STORAGE_KEY = `${APP_SLUG}-recent-properties`;
export const RECENT_PROPERTIES_MAX = 5;

export interface IRecentProperty {
  address: string;
  id: string;
  /** Tab suffix within the property shell, e.g. `/leases` or `""` for overview. */
  lastPath?: string;
  name: string;
  visitedAt: string;
}

export const EMPTY_RECENT_PROPERTIES: IRecentProperty[] = [];

const recentPropertiesListeners = new Set<() => void>();
let storageListenerAttached = false;
let cachedRecentPropertiesRaw: string | null | undefined;
let cachedRecentPropertiesSnapshot: IRecentProperty[] = EMPTY_RECENT_PROPERTIES;

function setRecentPropertiesSnapshot(raw: string | null, snapshot: IRecentProperty[]): void {
  cachedRecentPropertiesRaw = raw;
  cachedRecentPropertiesSnapshot = snapshot.length === 0 ? EMPTY_RECENT_PROPERTIES : snapshot;
}

function loadRecentPropertiesSnapshot(): IRecentProperty[] {
  if (globalThis.window === undefined) {
    return EMPTY_RECENT_PROPERTIES;
  }
  try {
    const raw = globalThis.window.localStorage.getItem(RECENT_PROPERTIES_STORAGE_KEY);
    if (raw === cachedRecentPropertiesRaw) {
      return cachedRecentPropertiesSnapshot;
    }
    const snapshot = parseRecentProperties(raw);
    setRecentPropertiesSnapshot(raw, snapshot);
    return cachedRecentPropertiesSnapshot;
  } catch {
    setRecentPropertiesSnapshot(null, EMPTY_RECENT_PROPERTIES);
    return EMPTY_RECENT_PROPERTIES;
  }
}

function broadcastRecentProperties() {
  for (const listener of recentPropertiesListeners) {
    listener();
  }
}

function onRecentPropertiesStorageEvent(event: StorageEvent) {
  if (event.key !== RECENT_PROPERTIES_STORAGE_KEY) {
    return;
  }
  cachedRecentPropertiesRaw = undefined;
  broadcastRecentProperties();
}

export function subscribeRecentProperties(onStoreChange: () => void): () => void {
  recentPropertiesListeners.add(onStoreChange);
  if (
    typeof globalThis !== "undefined" &&
    "addEventListener" in globalThis &&
    !storageListenerAttached
  ) {
    globalThis.addEventListener("storage", onRecentPropertiesStorageEvent);
    storageListenerAttached = true;
  }
  return () => {
    recentPropertiesListeners.delete(onStoreChange);
    if (
      recentPropertiesListeners.size === 0 &&
      storageListenerAttached &&
      typeof globalThis !== "undefined" &&
      "removeEventListener" in globalThis
    ) {
      globalThis.removeEventListener("storage", onRecentPropertiesStorageEvent);
      storageListenerAttached = false;
    }
  };
}

function isRecentProperty(value: unknown): value is IRecentProperty {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.name === "string" &&
    typeof entry.address === "string" &&
    typeof entry.visitedAt === "string" &&
    (entry.lastPath === undefined || typeof entry.lastPath === "string")
  );
}

export function parseRecentProperties(raw: string | null): IRecentProperty[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isRecentProperty);
  } catch {
    return [];
  }
}

export function readRecentProperties(): IRecentProperty[] {
  return loadRecentPropertiesSnapshot();
}

export function writeRecentProperties(entries: IRecentProperty[]): void {
  if (globalThis.window === undefined) {
    return;
  }
  try {
    const serialized = JSON.stringify(entries);
    globalThis.window.localStorage.setItem(RECENT_PROPERTIES_STORAGE_KEY, serialized);
    setRecentPropertiesSnapshot(serialized, entries);
    broadcastRecentProperties();
  } catch {
    /* private mode etc. */
  }
}

export function clearRecentProperties(): void {
  if (globalThis.window === undefined) {
    return;
  }
  try {
    globalThis.window.localStorage.removeItem(RECENT_PROPERTIES_STORAGE_KEY);
    setRecentPropertiesSnapshot(null, EMPTY_RECENT_PROPERTIES);
    broadcastRecentProperties();
  } catch {
    /* private mode etc. */
  }
}

export function recordRecentProperty({
  address,
  id,
  lastPath,
  name,
}: Pick<IRecentProperty, "address" | "id" | "name"> & Pick<Partial<IRecentProperty>, "lastPath">): void {
  const withoutCurrent = readRecentProperties().filter((entry) => entry.id !== id);
  const nextEntry: IRecentProperty = {
    address,
    id,
    name,
    visitedAt: new Date().toISOString(),
    ...(lastPath !== undefined ? { lastPath } : {}),
  };
  const next: IRecentProperty[] = [nextEntry, ...withoutCurrent].slice(0, RECENT_PROPERTIES_MAX);
  writeRecentProperties(next);
}

export function removeRecentProperty(id: string): void {
  const next = readRecentProperties().filter((entry) => entry.id !== id);
  if (next.length === readRecentProperties().length) {
    return;
  }
  writeRecentProperties(next);
}
