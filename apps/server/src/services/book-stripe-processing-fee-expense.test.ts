import { beforeEach, describe, expect, mock, test } from "bun:test";

import { makeExpense } from "@/test-fixtures/domain/expense";
import { makePayment } from "@/test-fixtures/domain/tenant-rent-payment";
import { mockAsyncFn, mockResolved } from "@/test-fixtures/mocks";

const mockEnsureSystemPaymentProcessingExpenseCategory = mockAsyncFn(() =>
  Promise.resolve({
    id: "cat-payment-processing",
    isAnnualAmount: false,
    isSystem: true,
    name: "Payment processing",
    propertyId: "property-1",
    sortOrder: -1,
  })
);

const mockCreateExpense = mockAsyncFn(() =>
  Promise.resolve(
    makeExpense({
      amount: 4.66,
      categoryId: "cat-payment-processing",
      categoryName: "Payment processing",
      description: "Stripe processing fee (rent payment payment-1)",
      expenseDate: "2026-07-22",
      id: "expense-fee-1",
      stripeBalanceTransactionId: "txn_1",
    })
  )
);

const mockGetStripeProcessingFeeCentsFromPaymentIntent = mockAsyncFn(() =>
  Promise.resolve({
    balanceTransactionId: "txn_1" as string | null,
    feeCents: 466,
  })
);

mock.module("@/db/property-expense-category-types", () => ({
  propertyExpenseCategoryTypesDb: {
    ensureSystemPaymentProcessingExpenseCategory: mockEnsureSystemPaymentProcessingExpenseCategory,
  },
}));

mock.module("@/db/property-expenses", () => ({
  propertyExpensesDb: {
    create: mockCreateExpense,
  },
}));

mock.module("@/lib/date-utils", () => ({
  getTodayUtcIsoDate: () => "2026-07-22",
}));

mock.module("@/lib/stripe-processing-fee", () => ({
  getStripeProcessingFeeCentsFromPaymentIntent: mockGetStripeProcessingFeeCentsFromPaymentIntent,
}));

mock.module("@/services/winston", () => ({
  WinstonLogger: {
    error: mockResolved(undefined),
    info: mockResolved(undefined),
    warn: mockResolved(undefined),
  },
}));

const {
  bookStripeProcessingFeeExpenseForRentPayment,
  buildStripeProcessingFeeExpenseDescription,
} = await import("./book-stripe-processing-fee-expense");

describe("bookStripeProcessingFeeExpenseForRentPayment", () => {
  beforeEach(() => {
    mockEnsureSystemPaymentProcessingExpenseCategory.mockClear();
    mockCreateExpense.mockClear();
    mockGetStripeProcessingFeeCentsFromPaymentIntent.mockClear();

    mockGetStripeProcessingFeeCentsFromPaymentIntent.mockResolvedValue({
      balanceTransactionId: "txn_1",
      feeCents: 466,
    });
    mockCreateExpense.mockResolvedValue(
      makeExpense({
        amount: 4.66,
        categoryId: "cat-payment-processing",
        categoryName: "Payment processing",
        description: buildStripeProcessingFeeExpenseDescription("payment-1"),
        expenseDate: "2026-07-22",
        id: "expense-fee-1",
        stripeBalanceTransactionId: "txn_1",
      })
    );
  });

  test("creates expense under Payment processing when stripe_fee > 0", async () => {
    const payment = makePayment({
      id: "payment-1",
      propertyId: "property-1",
      stripePaymentIntentId: "pi_1",
    });

    const expense = await bookStripeProcessingFeeExpenseForRentPayment(payment);

    expect(mockGetStripeProcessingFeeCentsFromPaymentIntent).toHaveBeenCalledWith("pi_1", {
      stripe: undefined,
    });
    expect(mockEnsureSystemPaymentProcessingExpenseCategory).toHaveBeenCalledWith("property-1");
    expect(mockCreateExpense).toHaveBeenCalledWith("property-1", {
      amount: 4.66,
      cashExpense: false,
      categoryId: "cat-payment-processing",
      description: "Stripe processing fee (rent payment payment-1)",
      expenseDate: "2026-07-22",
      stripeBalanceTransactionId: "txn_1",
    });
    expect(expense?.id).toBe("expense-fee-1");
    expect(expense?.stripeBalanceTransactionId).toBe("txn_1");
  });

  test("skips create when fee is 0", async () => {
    mockGetStripeProcessingFeeCentsFromPaymentIntent.mockResolvedValueOnce({
      balanceTransactionId: "txn_zero",
      feeCents: 0,
    });

    const expense = await bookStripeProcessingFeeExpenseForRentPayment(
      makePayment({ stripePaymentIntentId: "pi_1" })
    );

    expect(expense).toBeNull();
    expect(mockEnsureSystemPaymentProcessingExpenseCategory).not.toHaveBeenCalled();
    expect(mockCreateExpense).not.toHaveBeenCalled();
  });

  test("skips when payment has no PaymentIntent id", async () => {
    const expense = await bookStripeProcessingFeeExpenseForRentPayment(
      makePayment({ stripePaymentIntentId: null })
    );

    expect(expense).toBeNull();
    expect(mockGetStripeProcessingFeeCentsFromPaymentIntent).not.toHaveBeenCalled();
    expect(mockCreateExpense).not.toHaveBeenCalled();
  });

  test("duplicate booking returns existing expense from create no-op", async () => {
    const existing = makeExpense({
      amount: 4.66,
      categoryId: "cat-payment-processing",
      id: "expense-fee-1",
      stripeBalanceTransactionId: "txn_1",
    });
    mockCreateExpense.mockResolvedValueOnce(existing);
    mockCreateExpense.mockResolvedValueOnce(existing);

    const payment = makePayment({ stripePaymentIntentId: "pi_1" });
    const first = await bookStripeProcessingFeeExpenseForRentPayment(payment);
    const second = await bookStripeProcessingFeeExpenseForRentPayment(payment);

    expect(first?.id).toBe("expense-fee-1");
    expect(second?.id).toBe("expense-fee-1");
    expect(mockCreateExpense).toHaveBeenCalledTimes(2);
    expect(mockCreateExpense.mock.calls[1]?.[1]?.stripeBalanceTransactionId).toBe("txn_1");
  });
});
