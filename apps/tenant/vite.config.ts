import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { appUiThemeInitPlugin } from "../../packages/app-ui/src/vite/app-ui-theme-init-plugin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rootPackage = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../package.json"), "utf-8")
) as { version: string };

export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(rootPackage.version),
  },
  plugins: [
    appUiThemeInitPlugin("tenant"),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  preview: {
    host: true,
    port: Number(process.env.PORT) || 4174,
    strictPort: true,
  },
  resolve: {
    alias: [
      {
        find: "@/packages/app-ui",
        replacement: path.resolve(__dirname, "../../packages/app-ui/src"),
      },
      {
        find: "@/packages/shared",
        replacement: path.resolve(__dirname, "../../packages/shared/src"),
      },
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
  },
  server: {
    port: 5174,
    strictPort: true,
  },
});
