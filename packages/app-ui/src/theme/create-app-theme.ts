/// <reference lib="dom" />

import { APP_SLUG } from "../../../shared/src/constants";

import {
  DARK_PRESET_DEFAULT,
  DARK_PRESETS,
  type AppThemeKey,
  type DarkPreset,
  type ThemeChoice,
} from "./types";

export interface IAppTheme {
  appKey: AppThemeKey;
  applyDarkPreset: (preset: DarkPreset, persist?: boolean) => void;
  applyTheme: (choice: ThemeChoice, persist?: boolean) => void;
  darkPresetStorageKey: string;
  isSystemDark: () => boolean;
  readStoredDarkPreset: () => DarkPreset;
  readStoredTheme: () => ThemeChoice;
  subscribeStoredDarkPreset: (onStoreChange: () => void) => () => void;
  subscribeStoredTheme: (onStoreChange: () => void) => () => void;
  subscribeSystemTheme: (onChange: () => void) => () => void;
  themeInitScript: string;
  themeStorageKey: string;
}

export function createAppTheme(appKey: AppThemeKey): IAppTheme {
  const themeStorageKey = `${APP_SLUG}-${appKey}-theme`;
  const darkPresetStorageKey = `${APP_SLUG}-${appKey}-dark-preset`;

  const storedThemeListeners = new Set<() => void>();
  let themeStorageListenerAttached = false;

  const presetListeners = new Set<() => void>();
  let presetStorageListenerAttached = false;

  function broadcastStoredTheme() {
    for (const listener of storedThemeListeners) {
      listener();
    }
  }

  function broadcastPreset() {
    for (const listener of presetListeners) {
      listener();
    }
  }

  function onThemeStorageEvent(e: Event) {
    if (!(e instanceof StorageEvent) || e.key !== themeStorageKey) return;
    broadcastStoredTheme();
  }

  function onPresetStorageEvent(e: Event) {
    if (!(e instanceof StorageEvent) || e.key !== darkPresetStorageKey) return;
    broadcastPreset();
  }

  function subscribeStoredTheme(onStoreChange: () => void): () => void {
    storedThemeListeners.add(onStoreChange);
    if (typeof window !== "undefined" && !themeStorageListenerAttached) {
      window.addEventListener("storage", onThemeStorageEvent);
      themeStorageListenerAttached = true;
    }
    return () => {
      storedThemeListeners.delete(onStoreChange);
      if (
        storedThemeListeners.size === 0 &&
        themeStorageListenerAttached &&
        typeof window !== "undefined"
      ) {
        window.removeEventListener("storage", onThemeStorageEvent);
        themeStorageListenerAttached = false;
      }
    };
  }

  function readStoredTheme(): ThemeChoice {
    if (typeof window === "undefined") return "system";
    try {
      const raw = window.localStorage.getItem(themeStorageKey);
      if (raw === "dark" || raw === "light" || raw === "system") return raw;
    } catch {
      /* private mode etc. */
    }
    return "system";
  }

  function isSystemDark(): boolean {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function readStoredDarkPreset(): DarkPreset {
    if (typeof window === "undefined") return DARK_PRESET_DEFAULT;
    try {
      const raw = window.localStorage.getItem(darkPresetStorageKey);
      if (raw && (DARK_PRESETS as readonly string[]).includes(raw)) {
        return raw as DarkPreset;
      }
    } catch {
      /* private mode */
    }
    return DARK_PRESET_DEFAULT;
  }

  function applyDarkPreset(preset: DarkPreset, persist = true): void {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.darkPreset = preset;
    if (persist) {
      try {
        window?.localStorage.setItem(darkPresetStorageKey, preset);
        broadcastPreset();
      } catch {
        /* ignore */
      }
    }
  }

  function applyTheme(choice: ThemeChoice, persist = true): void {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const dark = choice === "dark" || (choice === "system" && isSystemDark());

    root.dataset.theme = choice;
    root.classList.toggle("dark", dark);
    root.style.colorScheme = dark ? "dark" : "light";

    if (dark) {
      applyDarkPreset(readStoredDarkPreset(), false);
    } else {
      root.removeAttribute("data-dark-preset");
    }

    if (persist) {
      try {
        localStorage.setItem(themeStorageKey, choice);
        broadcastStoredTheme();
      } catch {
        /* ignore */
      }
    }
  }

  function subscribeStoredDarkPreset(onStoreChange: () => void): () => void {
    presetListeners.add(onStoreChange);
    if (typeof window !== "undefined" && !presetStorageListenerAttached) {
      window.addEventListener("storage", onPresetStorageEvent);
      presetStorageListenerAttached = true;
    }
    return () => {
      presetListeners.delete(onStoreChange);
      if (
        presetListeners.size === 0 &&
        presetStorageListenerAttached &&
        typeof window !== "undefined"
      ) {
        window.removeEventListener("storage", onPresetStorageEvent);
        presetStorageListenerAttached = false;
      }
    };
  }

  function subscribeSystemTheme(onChange: () => void): () => void {
    if (typeof window === "undefined") {
      return () => {};
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }

  const themeInitScript = `(function(){try{var k=${JSON.stringify(themeStorageKey)};var pk=${JSON.stringify(darkPresetStorageKey)};var ok=[${DARK_PRESETS.map((p) => JSON.stringify(p)).join(",")}];var t=localStorage.getItem(k)||"system";if(t!=="light"&&t!=="dark"&&t!=="system")t="system";var r=document.documentElement;r.dataset.theme=t;var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";if(d){var pv=localStorage.getItem(pk)||${JSON.stringify(DARK_PRESET_DEFAULT)};if(ok.indexOf(pv)<0)pv=${JSON.stringify(DARK_PRESET_DEFAULT)};r.setAttribute("data-dark-preset",pv);}else{r.removeAttribute("data-dark-preset");}}catch(e){}})();`;

  return {
    appKey,
    applyDarkPreset,
    applyTheme,
    darkPresetStorageKey,
    isSystemDark,
    readStoredDarkPreset,
    readStoredTheme,
    subscribeStoredDarkPreset,
    subscribeStoredTheme,
    subscribeSystemTheme,
    themeInitScript,
    themeStorageKey,
  };
}
