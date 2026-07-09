import { describe, expect, test } from "bun:test";

import { ExpenseCategory } from "@/packages/shared";

import {
  normalizeExpenseImportCategory,
  parseCreateExpenseBody,
  validateExpenseDateNotInFuture,
} from "../lib/validate-create-expense-body";

describe("normalizeExpenseImportCategory", () => {
  test("falls back to other for unknown categories", () => {
    expect(normalizeExpenseImportCategory("guest_list")).toBe(ExpenseCategory.OTHER);
    expect(normalizeExpenseImportCategory("electricity")).toBe(ExpenseCategory.ELECTRICITY);
  });
});

describe("parseCreateExpenseBody", () => {
  test("requires description for other category", () => {
    const parsed = parseCreateExpenseBody({
      amount: 25,
      category: ExpenseCategory.OTHER,
      description: "",
    });

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toContain("description");
    }
  });

  test("accepts valid expense body", () => {
    const parsed = parseCreateExpenseBody({
      amount: 120.5,
      category: ExpenseCategory.CLEANING,
      expenseDate: "2026-01-15",
      taxFree: false,
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.body.amount).toBe(120.5);
      expect(parsed.body.category).toBe(ExpenseCategory.CLEANING);
    }
  });
});

describe("validateExpenseDateNotInFuture", () => {
  test("rejects future dates", () => {
    expect(validateExpenseDateNotInFuture("2999-01-01")).toBe(
      "Expense date cannot be in the future"
    );
  });
});
