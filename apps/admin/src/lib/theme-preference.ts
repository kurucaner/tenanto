import { getAppTheme, type ThemeChoice } from "@/packages/app-ui";

export type { ThemeChoice };

const adminTheme = getAppTheme("admin");

export const THEME_STORAGE_KEY = adminTheme.themeStorageKey;
export const THEME_INIT_SCRIPT = adminTheme.themeInitScript;

export const applyTheme = adminTheme.applyTheme;
export const isSystemDark = adminTheme.isSystemDark;
export const readStoredTheme = adminTheme.readStoredTheme;
export const subscribeStoredTheme = adminTheme.subscribeStoredTheme;
export const subscribeSystemTheme = adminTheme.subscribeSystemTheme;
