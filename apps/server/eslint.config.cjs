const path = require("node:path");

const { defineConfig } = require("eslint/config");
const typescriptParser = require("@typescript-eslint/parser");
const typescriptPlugin = require("@typescript-eslint/eslint-plugin");
const simpleImportSort = require("eslint-plugin-simple-import-sort");
const perfectionist = require("eslint-plugin-perfectionist");

module.exports = defineConfig([
  {
    ignores: ["dist/*", "logs/*", "node_modules/*"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        tsconfigRootDir: path.dirname(__filename),
      },
    },
    plugins: {
      "@typescript-eslint": typescriptPlugin,
      perfectionist: perfectionist,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "perfectionist/sort-enums": "error",
      "perfectionist/sort-interfaces": "error",
      "perfectionist/sort-objects": "error",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
]);
