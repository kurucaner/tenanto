import { useMemo, useSyncExternalStore } from "react";

import { useAppTheme } from "../theme/app-theme-provider";

function getServerResolvedDark(): boolean {
  return false;
}

/** True when the UI should show dark appearance (matches `html.dark` after `applyTheme`). */
export function useResolvedDark(): boolean {
  const theme = useAppTheme();
  const subscribe = useMemo(
    () => (onStoreChange: () => void) => {
      const unsubTheme = theme.subscribeStoredTheme(onStoreChange);
      const unsubSystem = theme.subscribeSystemTheme(onStoreChange);
      return () => {
        unsubTheme();
        unsubSystem();
      };
    },
    [theme]
  );
  const getSnapshot = useMemo(
    () => () => {
      const choice = theme.readStoredTheme();
      return choice === "dark" || (choice === "system" && theme.isSystemDark());
    },
    [theme]
  );
  return useSyncExternalStore(subscribe, getSnapshot, getServerResolvedDark);
}
