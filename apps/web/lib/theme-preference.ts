import { APP_SLUG } from "@/packages/shared";

export type ThemeChoice = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = `${APP_SLUG}-theme`;
const LEGACY_THEME_STORAGE_KEY = "tenanto-theme";

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
  if (typeof globalThis !== "undefined" && "addEventListener" in globalThis && !storageListenerAttached) {
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
  if (typeof window === "undefined") return "system";
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* private mode etc. */
  }
  return "system";
}

export function isSystemDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Applies class + color-scheme + optional persistence. */
export function applyTheme(choice: ThemeChoice, persist = true): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const dark = choice === "dark" || (choice === "system" && isSystemDark());

  root.dataset.theme = choice;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, choice);
      broadcastStoredTheme();
    } catch {
      /* ignore */
    }
  }
}

/** Inline string for `beforeInteractive` script (must stay in sync with key + logic). */
export const THEME_INIT_SCRIPT = `(function(){try{var lk=${JSON.stringify(LEGACY_THEME_STORAGE_KEY)};var k=${JSON.stringify(THEME_STORAGE_KEY)};var lv=localStorage.getItem(lk);if(lv!==null&&localStorage.getItem(k)===null){localStorage.setItem(k,lv);localStorage.removeItem(lk);}var t=localStorage.getItem(k)||"system";if(t!=="light"&&t!=="dark"&&t!=="system")t="system";var r=document.documentElement;r.dataset.theme=t;var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

export function subscribeSystemTheme(onChange: () => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
