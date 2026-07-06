import { APP_SLUG } from "@/packages/shared";

export const DARK_PRESET_STORAGE_KEY = `${APP_SLUG}-admin-dark-preset`;
export const LEGACY_DARK_PRESET_STORAGE_KEY = "tenanto-admin-dark-preset";

export const DARK_PRESET_DEFAULT = "noir" as const;

export type DarkPreset = "noir" | "obsidian" | "evergreen" | "plum" | "ember" | "inkwell";

export const DARK_PRESETS: readonly DarkPreset[] = [
  "noir",
  "obsidian",
  "evergreen",
  "plum",
  "ember",
  "inkwell",
] as const;

const presetListeners = new Set<() => void>();
let presetStorageAttached = false;

function broadcastPreset() {
  for (const listener of presetListeners) {
    listener();
  }
}

function onPresetStorage(e: StorageEvent) {
  if (e.key !== DARK_PRESET_STORAGE_KEY) return;
  broadcastPreset();
}

export function subscribeStoredDarkPreset(onStoreChange: () => void): () => void {
  presetListeners.add(onStoreChange);
  if (globalThis.window !== undefined && !presetStorageAttached) {
    globalThis.window.addEventListener("storage", onPresetStorage);
    presetStorageAttached = true;
  }
  return () => {
    presetListeners.delete(onStoreChange);
    if (presetListeners.size === 0 && presetStorageAttached && globalThis.window !== undefined) {
      globalThis.window.removeEventListener("storage", onPresetStorage);
      presetStorageAttached = false;
    }
  };
}

export function isDarkPreset(value: string): value is DarkPreset {
  return (DARK_PRESETS as readonly string[]).includes(value);
}

export function readStoredDarkPreset(): DarkPreset {
  if (globalThis.window === undefined) return DARK_PRESET_DEFAULT;
  try {
    const raw = globalThis.window.localStorage.getItem(DARK_PRESET_STORAGE_KEY);
    if (raw && isDarkPreset(raw)) return raw;
  } catch {
    /* private mode */
  }
  return DARK_PRESET_DEFAULT;
}

/** Sets `data-dark-preset` on `<html>` (only meaningful with `html.dark`). */
export function applyDarkPreset(preset: DarkPreset, persist = true): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.darkPreset = preset;
  if (persist) {
    try {
      globalThis.window?.localStorage.setItem(DARK_PRESET_STORAGE_KEY, preset);
      broadcastPreset();
    } catch {
      /* ignore */
    }
  }
}

export const DARK_PRESET_OPTIONS: readonly {
  mood: string;
  label: string;
  swatchA: string;
  swatchB: string;
  swatchC: string;
  value: DarkPreset;
}[] = [
  {
    value: "noir",
    label: "Noir",
    mood: "Cool slate + champagne",
    swatchA: "oklch(0.14 0.02 262)",
    swatchB: "oklch(0.22 0.022 262)",
    swatchC: "oklch(0.78 0.09 88)",
  },
  {
    value: "obsidian",
    label: "Obsidian",
    mood: "Neutral luxury",
    swatchA: "oklch(0.14 0.006 280)",
    swatchB: "oklch(0.2 0.01 280)",
    swatchC: "oklch(0.8 0.04 285)",
  },
  {
    value: "evergreen",
    label: "Evergreen",
    mood: "Forest terminal",
    swatchA: "oklch(0.13 0.03 165)",
    swatchB: "oklch(0.2 0.035 165)",
    swatchC: "oklch(0.72 0.11 150)",
  },
  {
    value: "plum",
    label: "Plum",
    mood: "Studio violet",
    swatchA: "oklch(0.14 0.035 305)",
    swatchB: "oklch(0.2 0.04 305)",
    swatchC: "oklch(0.72 0.1 295)",
  },
  {
    value: "ember",
    label: "Ember",
    mood: "Warm charcoal + copper",
    swatchA: "oklch(0.14 0.022 48)",
    swatchB: "oklch(0.21 0.028 48)",
    swatchC: "oklch(0.76 0.11 62)",
  },
  {
    value: "inkwell",
    label: "Inkwell",
    mood: "Cold cyan night",
    swatchA: "oklch(0.13 0.028 235)",
    swatchB: "oklch(0.2 0.03 235)",
    swatchC: "oklch(0.72 0.12 208)",
  },
] as const;
