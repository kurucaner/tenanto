import type { Plugin } from "vite";

import { getAppTheme } from "../theme/get-app-theme";
import type { AppThemeKey } from "../theme/types";

export function appUiThemeInitPlugin(appKey: AppThemeKey): Plugin {
  return {
    name: "app-ui-theme-init",
    transformIndexHtml(html) {
      const script = getAppTheme(appKey).themeInitScript;
      if (html.includes("app-ui-theme-init")) {
        return html;
      }
      return html.replace("<head>", `<head>\n    <script data-app-ui-theme-init>${script}</script>`);
    },
  };
}
