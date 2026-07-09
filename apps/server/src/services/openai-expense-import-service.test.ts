import { describe, expect, test } from "bun:test";

import { ExpenseCategory } from "@/packages/shared";
import { parseOpenAiExpenseImportContent } from "@/services/openai-expense-import-service";

describe("parseOpenAiExpenseImportContent", () => {
  test("maps parsed expenses and normalizes unknown categories", () => {
    const result = parseOpenAiExpenseImportContent(
      JSON.stringify({
        expenses: [
          {
            amount: 42.5,
            category: "not_a_real_category",
            description: "Supplies",
            expenseDate: "2026-02-01",
            personName: null,
            taxFree: null,
          },
        ],
        message: "Parsed expenses",
        status: "parsed",
      })
    );

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.status).toBe("parsed");
      expect(result.expenses[0]?.category).toBe(ExpenseCategory.OTHER);
      expect(result.expenses[0]?.amount).toBe(42.5);
    }
  });

  test("returns irrelevant files with message", () => {
    const result = parseOpenAiExpenseImportContent(
      JSON.stringify({
        expenses: [],
        message: "This file looks like a guest reservation export.",
        status: "irrelevant",
      })
    );

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.status).toBe("irrelevant");
      expect(result.expenses).toEqual([]);
      expect(result.message).toContain("guest reservation");
    }
  });

  test("rejects invalid JSON payloads", () => {
    const result = parseOpenAiExpenseImportContent("{ not-json");
    expect(result).toEqual({ error: "OpenAI returned invalid JSON" });
  });
});
