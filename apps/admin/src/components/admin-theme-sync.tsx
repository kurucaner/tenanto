import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";

import {
  applyDarkPreset,
  DARK_PRESET_DEFAULT,
  type DarkPreset,
  readStoredDarkPreset,
  subscribeStoredDarkPreset,
} from "@/lib/dark-preset-preference";
import {
  applyTheme,
  isSystemDark,
  readStoredTheme,
  subscribeStoredTheme,
  subscribeSystemTheme,
  type ThemeChoice,
} from "@/lib/theme-preference";

function getServerThemeChoice(): ThemeChoice {
  return "system";
}

function getServerDarkPreset(): DarkPreset {
  return DARK_PRESET_DEFAULT;
}

/** Keeps `document.documentElement` in sync with stored choice, system preference, and other tabs. */
export function AdminThemeSync() {
  const choice = useSyncExternalStore(subscribeStoredTheme, readStoredTheme, getServerThemeChoice);
  const preset = useSyncExternalStore(
    subscribeStoredDarkPreset,
    readStoredDarkPreset,
    getServerDarkPreset
  );

  useLayoutEffect(() => {
    applyTheme(choice, false);
  }, [choice]);

  useLayoutEffect(() => {
    const dark = choice === "dark" || (choice === "system" && isSystemDark());
    if (dark) {
      applyDarkPreset(readStoredDarkPreset(), false);
    } else {
      document.documentElement.removeAttribute("data-dark-preset");
    }
  }, [choice, preset]);

  useEffect(() => {
    if (choice !== "system") return;
    return subscribeSystemTheme(() => {
      applyTheme("system", false);
    });
  }, [choice]);

  return null;
}
