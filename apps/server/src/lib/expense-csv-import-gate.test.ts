import { describe, expect, test } from "bun:test";

import { getOpenAiApiKey, isExpenseCsvImportEnabled } from "../lib/expense-csv-import-gate";

describe("isExpenseCsvImportEnabled", () => {
  test("returns false in production even when flag is set", () => {
    const originalNodeEnv = process.env["NODE_ENV"];
    const originalFlag = process.env["EXPENSE_CSV_IMPORT_ENABLED"];

    process.env["NODE_ENV"] = "production";
    process.env["EXPENSE_CSV_IMPORT_ENABLED"] = "true";

    expect(isExpenseCsvImportEnabled()).toBe(false);

    process.env["NODE_ENV"] = originalNodeEnv;
    process.env["EXPENSE_CSV_IMPORT_ENABLED"] = originalFlag;
  });

  test("returns true in non-production when flag is set", () => {
    const originalNodeEnv = process.env["NODE_ENV"];
    const originalFlag = process.env["EXPENSE_CSV_IMPORT_ENABLED"];

    process.env["NODE_ENV"] = "development";
    process.env["EXPENSE_CSV_IMPORT_ENABLED"] = "true";

    expect(isExpenseCsvImportEnabled()).toBe(true);

    process.env["NODE_ENV"] = originalNodeEnv;
    process.env["EXPENSE_CSV_IMPORT_ENABLED"] = originalFlag;
  });
});

describe("getOpenAiApiKey", () => {
  test("returns null for missing or blank key", () => {
    const original = process.env["OPENAI_API_KEY"];
    process.env["OPENAI_API_KEY"] = "   ";
    expect(getOpenAiApiKey()).toBeNull();
    process.env["OPENAI_API_KEY"] = original;
  });
});
