import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";

import { useAppTheme } from "../theme/app-theme-provider";
import { DARK_PRESET_DEFAULT, type DarkPreset } from "../theme/types";

function getServerThemeChoice() {
  return "system" as const;
}

function getServerDarkPreset(): DarkPreset {
  return DARK_PRESET_DEFAULT;
}

/** Keeps `document.documentElement` in sync with stored choice, system preference, and other tabs. */
export function ThemeSync() {
  const theme = useAppTheme();
  const choice = useSyncExternalStore(
    theme.subscribeStoredTheme,
    theme.readStoredTheme,
    getServerThemeChoice
  );
  const preset = useSyncExternalStore(
    theme.subscribeStoredDarkPreset,
    theme.readStoredDarkPreset,
    getServerDarkPreset
  );

  useLayoutEffect(() => {
    theme.applyTheme(choice, false);
  }, [choice, theme]);

  useLayoutEffect(() => {
    const dark = choice === "dark" || (choice === "system" && theme.isSystemDark());
    if (dark) {
      theme.applyDarkPreset(theme.readStoredDarkPreset(), false);
    } else {
      document.documentElement.removeAttribute("data-dark-preset");
    }
  }, [choice, preset, theme]);

  useEffect(() => {
    if (choice !== "system") return;
    return theme.subscribeSystemTheme(() => {
      theme.applyTheme("system", false);
    });
  }, [choice, theme]);

  return null;
}
