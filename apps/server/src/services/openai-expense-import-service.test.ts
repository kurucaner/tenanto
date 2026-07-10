import { describe, expect, test } from "bun:test";

import {
  mergeExtractedRowsWithCategories,
  parseExpenseCategoryAssignments,
} from "./openai-expense-import-service";

const CATEGORY_TYPES = [
  {
    id: "uuid-sub",
    isAnnualAmount: false,
    name: "Subscription",
    propertyId: "prop-1",
    sortOrder: 0,
  },
  {
    id: "uuid-internet",
    isAnnualAmount: false,
    name: "Internet",
    propertyId: "prop-1",
    sortOrder: 1,
  },
  { id: "uuid-other", isAnnualAmount: false, name: "Other", propertyId: "prop-1", sortOrder: 99 },
];

describe("parseExpenseCategoryAssignments", () => {
  test("maps assignments and normalizes unknown categories to other", () => {
    const result = parseExpenseCategoryAssignments(
      JSON.stringify({
        assignments: [
          { categoryName: "Subscription", rowIndex: 1 },
          { categoryName: "not_a_real_category", rowIndex: 2 },
        ],
      }),
      CATEGORY_TYPES,
      [1, 2]
    );

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.assignments).toEqual([
      { categoryName: "Subscription", rowIndex: 1 },
      { categoryName: "Other", rowIndex: 2 },
    ]);
  });

  test("fills missing row indexes with other", () => {
    const result = parseExpenseCategoryAssignments(
      JSON.stringify({
        assignments: [{ categoryName: "Internet", rowIndex: 1 }],
      }),
      CATEGORY_TYPES,
      [1, 2, 3]
    );

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.assignments).toEqual([
      { categoryName: "Internet", rowIndex: 1 },
      { categoryName: "Other", rowIndex: 2 },
      { categoryName: "Other", rowIndex: 3 },
    ]);
  });

  test("rejects invalid JSON payloads", () => {
    const result = parseExpenseCategoryAssignments("{ not-json", CATEGORY_TYPES, [1]);
    expect(result).toEqual({ error: "OpenAI returned invalid JSON" });
  });
});

describe("mergeExtractedRowsWithCategories", () => {
  test("merges extracted rows with category assignments by resolving names to IDs", () => {
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
      [{ categoryName: "Subscription", rowIndex: 3 }],
      CATEGORY_TYPES
    );

    expect(merged).toEqual([
      {
        amount: 17.74,
        categoryId: "uuid-sub",
        description: "Amazon web services (Bills & Utilities)",
        expenseDate: "2026-07-02",
        rowIndex: 3,
        sourceFileName: "chase.csv",
      },
    ]);
  });
});
