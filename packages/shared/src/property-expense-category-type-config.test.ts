import { describe, expect, test } from "bun:test";

import {
  DEFAULT_PROPERTY_EXPENSE_CATEGORY_TYPES,
  isSystemPaymentProcessingExpenseCategoryName,
  SYSTEM_PAYMENT_PROCESSING_EXPENSE_CATEGORY_NAME,
} from "./property-expense-category-type-config";

describe("SYSTEM_PAYMENT_PROCESSING_EXPENSE_CATEGORY_NAME", () => {
  test("is Payment processing", () => {
    expect(SYSTEM_PAYMENT_PROCESSING_EXPENSE_CATEGORY_NAME).toBe("Payment processing");
  });
});

describe("isSystemPaymentProcessingExpenseCategoryName", () => {
  test("matches Payment processing case-insensitively", () => {
    expect(
      isSystemPaymentProcessingExpenseCategoryName(SYSTEM_PAYMENT_PROCESSING_EXPENSE_CATEGORY_NAME)
    ).toBe(true);
    expect(isSystemPaymentProcessingExpenseCategoryName("payment processing")).toBe(true);
    expect(isSystemPaymentProcessingExpenseCategoryName("PAYMENT PROCESSING")).toBe(true);
  });

  test("returns false for other category names", () => {
    expect(isSystemPaymentProcessingExpenseCategoryName("Other")).toBe(false);
    expect(isSystemPaymentProcessingExpenseCategoryName("Stripe")).toBe(false);
    expect(isSystemPaymentProcessingExpenseCategoryName("")).toBe(false);
  });
});

describe("DEFAULT_PROPERTY_EXPENSE_CATEGORY_TYPES", () => {
  test("does not include system Payment processing (ensure-only)", () => {
    const names = DEFAULT_PROPERTY_EXPENSE_CATEGORY_TYPES.map((t) => t.name.toLowerCase());
    expect(names).not.toContain(SYSTEM_PAYMENT_PROCESSING_EXPENSE_CATEGORY_NAME.toLowerCase());
  });
});
