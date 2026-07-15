import { createContext, memo, type ReactNode, useContext, useMemo } from "react";

import { type IAppTheme } from "./create-app-theme";
import { getAppTheme } from "./get-app-theme";
import type { AppThemeKey } from "./types";

const AppThemeContext = createContext<IAppTheme | null>(null);

interface AppThemeProviderProps {
  appKey: AppThemeKey;
  children: ReactNode;
}

export const AppThemeProvider = memo(function AppThemeProvider({
  appKey,
  children,
}: AppThemeProviderProps) {
  const theme = useMemo(() => getAppTheme(appKey), [appKey]);
  return <AppThemeContext.Provider value={theme}>{children}</AppThemeContext.Provider>;
});
AppThemeProvider.displayName = "AppThemeProvider";

export function useAppTheme(): IAppTheme {
  const theme = useContext(AppThemeContext);
  if (!theme) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return theme;
}
