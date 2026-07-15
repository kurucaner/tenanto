import { createAppTheme, type IAppTheme } from "./create-app-theme";
import type { AppThemeKey } from "./types";

const themeCache = new Map<AppThemeKey, IAppTheme>();

export function getAppTheme(appKey: AppThemeKey): IAppTheme {
  const cached = themeCache.get(appKey);
  if (cached) {
    return cached;
  }
  const theme = createAppTheme(appKey);
  themeCache.set(appKey, theme);
  return theme;
}
