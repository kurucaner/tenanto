import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootPackage = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../package.json"), "utf-8")
) as { version: string };
const appVersion = process.env.VITE_APP_VERSION ?? rootPackage.version;

// https://vite.dev/config/
export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
  },
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  resolve: {
    alias: [
      {
        find: "@/packages/shared",
        replacement: path.resolve(__dirname, "../../packages/shared/src"),
      },
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
  },
});
