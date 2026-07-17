import { getAppTheme } from "@/packages/app-ui";

export type { DarkPreset } from "@/packages/app-ui";
export {
  DARK_PRESET_DEFAULT,
  DARK_PRESET_OPTIONS,
  DARK_PRESETS,
  isDarkPreset,
} from "@/packages/app-ui";

const adminTheme = getAppTheme("admin");

export const DARK_PRESET_STORAGE_KEY = adminTheme.darkPresetStorageKey;

export const applyDarkPreset = adminTheme.applyDarkPreset;
export const readStoredDarkPreset = adminTheme.readStoredDarkPreset;
export const subscribeStoredDarkPreset = adminTheme.subscribeStoredDarkPreset;
