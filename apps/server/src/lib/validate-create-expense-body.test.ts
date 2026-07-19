import { describe, expect, test } from "bun:test";

import {
  parseCreateExpenseBody,
  validateExpenseDateNotInFuture,
} from "../lib/validate-create-expense-body";

const VALID_CATEGORY_ID = "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";

describe("parseCreateExpenseBody", () => {
  test("rejects missing categoryId", () => {
    const parsed = parseCreateExpenseBody({
      amount: 25,
    });

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toContain("categoryId");
    }
  });

  test("rejects non-UUID categoryId", () => {
    const parsed = parseCreateExpenseBody({
      amount: 25,
      categoryId: "not-a-uuid",
    });

    expect(parsed.ok).toBe(false);
  });

  test("accepts valid expense body with UUID categoryId", () => {
    const parsed = parseCreateExpenseBody({
      amount: 120.5,
      categoryId: VALID_CATEGORY_ID,
      expenseDate: "2026-01-15",
      cashExpense: false,
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.body.amount).toBe(120.5);
      expect(parsed.body.categoryId).toBe(VALID_CATEGORY_ID);
    }
  });

  test("rejects negative amounts", () => {
    const parsed = parseCreateExpenseBody({
      amount: -10,
      categoryId: VALID_CATEGORY_ID,
    });

    expect(parsed.ok).toBe(false);
  });
});

describe("validateExpenseDateNotInFuture", () => {
  test("rejects future dates", () => {
    expect(validateExpenseDateNotInFuture("2999-01-01")).toBe(
      "Expense date cannot be in the future"
    );
  });

  test("accepts past dates", () => {
    expect(validateExpenseDateNotInFuture("2020-01-01")).toBeNull();
  });

  test("accepts undefined", () => {
    expect(validateExpenseDateNotInFuture(undefined)).toBeNull();
  });
});
