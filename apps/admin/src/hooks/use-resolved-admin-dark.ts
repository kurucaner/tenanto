import { useSyncExternalStore } from "react";

import {
  isSystemDark,
  readStoredTheme,
  subscribeStoredTheme,
  subscribeSystemTheme,
} from "@/lib/theme-preference";

function subscribeResolvedAdminDark(onStoreChange: () => void): () => void {
  const unsubTheme = subscribeStoredTheme(onStoreChange);
  const unsubSystem = subscribeSystemTheme(onStoreChange);
  return () => {
    unsubTheme();
    unsubSystem();
  };
}

function readResolvedAdminDark(): boolean {
  const choice = readStoredTheme();
  return choice === "dark" || (choice === "system" && isSystemDark());
}

function getServerResolvedAdminDark(): boolean {
  return false;
}

/** True when the admin UI should show dark appearance (matches `html.dark` after `applyTheme`). */
export function useResolvedAdminDark(): boolean {
  return useSyncExternalStore(subscribeResolvedAdminDark, readResolvedAdminDark, getServerResolvedAdminDark);
}
