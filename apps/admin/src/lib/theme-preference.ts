import { APP_SLUG } from "@/packages/shared";

import {
  applyDarkPreset,
  DARK_PRESET_DEFAULT,
  DARK_PRESET_STORAGE_KEY,
  DARK_PRESETS,
  readStoredDarkPreset,
} from "./dark-preset-preference";

export type ThemeChoice = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = `${APP_SLUG}-admin-theme`;

const storedThemeListeners = new Set<() => void>();
let storageListenerAttached = false;

function broadcastStoredTheme() {
  for (const listener of storedThemeListeners) {
    listener();
  }
}

function onThemeStorageEvent(e: StorageEvent) {
  if (e.key !== THEME_STORAGE_KEY) return;
  broadcastStoredTheme();
}

/** For `useSyncExternalStore`: cross-tab `storage` + same-tab writes via `applyTheme(..., true)`. */
export function subscribeStoredTheme(onStoreChange: () => void): () => void {
  storedThemeListeners.add(onStoreChange);
  if (
    typeof globalThis !== "undefined" &&
    "addEventListener" in globalThis &&
    !storageListenerAttached
  ) {
    globalThis.addEventListener("storage", onThemeStorageEvent);
    storageListenerAttached = true;
  }
  return () => {
    storedThemeListeners.delete(onStoreChange);
    if (
      storedThemeListeners.size === 0 &&
      storageListenerAttached &&
      typeof globalThis !== "undefined" &&
      "removeEventListener" in globalThis
    ) {
      globalThis.removeEventListener("storage", onThemeStorageEvent);
      storageListenerAttached = false;
    }
  };
}

export function readStoredTheme(): ThemeChoice {
  if (globalThis.window === undefined) return "system";
  try {
    const raw = globalThis.window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* private mode etc. */
  }
  return "system";
}

export function isSystemDark(): boolean {
  if (globalThis.window === undefined) return false;
  return globalThis.window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Applies class + color-scheme + optional persistence. */
export function applyTheme(choice: ThemeChoice, persist = true): void {
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
      localStorage.setItem(THEME_STORAGE_KEY, choice);
      broadcastStoredTheme();
    } catch {
      /* ignore */
    }
  }
}

/** Inline string for `<head>` (must stay in sync with `index.html` + logic). */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var pk=${JSON.stringify(DARK_PRESET_STORAGE_KEY)};var ok=[${DARK_PRESETS.map((p) => JSON.stringify(p)).join(",")}];var t=localStorage.getItem(k)||"system";if(t!=="light"&&t!=="dark"&&t!=="system")t="system";var r=document.documentElement;r.dataset.theme=t;var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";if(d){var pv=localStorage.getItem(pk)||${JSON.stringify(DARK_PRESET_DEFAULT)};if(ok.indexOf(pv)<0)pv=${JSON.stringify(DARK_PRESET_DEFAULT)};r.setAttribute("data-dark-preset",pv);}else{r.removeAttribute("data-dark-preset");}}catch(e){}})();`;

export function subscribeSystemTheme(onChange: () => void): () => void {
  if (globalThis.window === undefined) {
    return () => {};
  }
  const mq = globalThis.window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
