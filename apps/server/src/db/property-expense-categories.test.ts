import { describe, expect, test } from "bun:test";

import { ExpenseCategory } from "@/packages/shared";

import { buildPropertyExpenseCategoryOptions } from "./property-expense-categories";

describe("buildPropertyExpenseCategoryOptions", () => {
  test("maps DB enum values to labels and includes every shared category", () => {
    const values = Object.values(ExpenseCategory);
    const options = buildPropertyExpenseCategoryOptions(values);

    expect(options).toHaveLength(values.length);
    expect(options.find((option) => option.value === ExpenseCategory.OTHER)?.label).toBe("Other");
    expect(options.find((option) => option.value === ExpenseCategory.SUBSCRIPTION)?.label).toBe(
      "Subscription"
    );
  });
});
