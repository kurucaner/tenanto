import js from "@eslint/js";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import perfectionist from "eslint-plugin-perfectionist";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      perfectionist: perfectionist,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "perfectionist/sort-enums": "error",
      "perfectionist/sort-interfaces": "error",
      "perfectionist/sort-objects": "error",
      "simple-import-sort/exports": "error",
      "simple-import-sort/imports": "error",
    },
  },
]);
