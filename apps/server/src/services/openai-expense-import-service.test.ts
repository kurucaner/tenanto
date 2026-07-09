import { describe, expect, test } from "bun:test";

import { ExpenseCategory } from "@/packages/shared";

import {
  mergeExtractedRowsWithCategories,
  parseExpenseCategoryAssignments,
} from "./openai-expense-import-service";

const ALLOWED_CATEGORIES = Object.values(ExpenseCategory);

describe("parseExpenseCategoryAssignments", () => {
  test("maps assignments and normalizes unknown categories to other", () => {
    const result = parseExpenseCategoryAssignments(
      JSON.stringify({
        assignments: [
          { category: "subscription", rowIndex: 1 },
          { category: "not_a_real_category", rowIndex: 2 },
        ],
      }),
      ALLOWED_CATEGORIES,
      [1, 2]
    );

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.assignments).toEqual([
      { category: ExpenseCategory.SUBSCRIPTION, rowIndex: 1 },
      { category: ExpenseCategory.OTHER, rowIndex: 2 },
    ]);
  });

  test("fills missing row indexes with other", () => {
    const result = parseExpenseCategoryAssignments(
      JSON.stringify({
        assignments: [{ category: "internet", rowIndex: 1 }],
      }),
      ALLOWED_CATEGORIES,
      [1, 2, 3]
    );

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.assignments).toEqual([
      { category: ExpenseCategory.INTERNET, rowIndex: 1 },
      { category: ExpenseCategory.OTHER, rowIndex: 2 },
      { category: ExpenseCategory.OTHER, rowIndex: 3 },
    ]);
  });

  test("rejects invalid JSON payloads", () => {
    const result = parseExpenseCategoryAssignments("{ not-json", ALLOWED_CATEGORIES, [1]);
    expect(result).toEqual({ error: "OpenAI returned invalid JSON" });
  });
});

describe("mergeExtractedRowsWithCategories", () => {
  test("merges extracted rows with category assignments", () => {
    const merged = mergeExtractedRowsWithCategories(
      [
        {
          amount: 17.74,
          description: "Amazon web services (Bills & Utilities)",
          expenseDate: "2026-07-02",
          rowIndex: 3,
          sourceFileName: "chase.csv",
        },
      ],
      [{ category: ExpenseCategory.SUBSCRIPTION, rowIndex: 3 }]
    );

    expect(merged).toEqual([
      {
        amount: 17.74,
        category: ExpenseCategory.SUBSCRIPTION,
        description: "Amazon web services (Bills & Utilities)",
        expenseDate: "2026-07-02",
        rowIndex: 3,
        sourceFileName: "chase.csv",
      },
    ]);
  });
});
