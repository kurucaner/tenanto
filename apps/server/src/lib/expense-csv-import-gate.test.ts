import { describe, expect, test } from "bun:test";

import { getOpenAiApiKey } from "../lib/expense-csv-import-gate";

describe("getOpenAiApiKey", () => {
  test("returns null for missing or blank key", () => {
    const original = process.env["OPENAI_API_KEY"];
    process.env["OPENAI_API_KEY"] = "   ";
    expect(getOpenAiApiKey()).toBeNull();
    process.env["OPENAI_API_KEY"] = original;
  });
});
