import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rootPackage = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../package.json"), "utf-8")
) as { version: string };
// https://vite.dev/config/
export default defineConfig({
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
  preview: {
    host: true,
    port: Number(process.env.PORT) || 4173,
    strictPort: true,
    allowedHosts: [".edgium.tech"],
  },
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(rootPackage.version),
  },
});
