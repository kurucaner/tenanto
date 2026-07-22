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

const mockGetStripeProcessingFeeCentsFromCharge = mock(
  (_charge: unknown): { balanceTransactionId: string | null; feeCents: number } => ({
    balanceTransactionId: "txn_ach_return",
    feeCents: 400,
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
  getStripeProcessingFeeCentsFromBalanceTransaction: mockAsyncFn(() =>
    Promise.resolve({ balanceTransactionId: null, feeCents: 0 })
  ),
  getStripeProcessingFeeCentsFromCharge: mockGetStripeProcessingFeeCentsFromCharge,
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
  bookAchReturnFeeExpenseForRentPayment,
  bookStripeProcessingFeeExpenseForRentPayment,
  buildAchReturnFeeExpenseDescription,
  buildStripeProcessingFeeExpenseDescription,
} = await import("./book-stripe-processing-fee-expense");

describe("bookStripeProcessingFeeExpenseForRentPayment", () => {
  beforeEach(() => {
    mockEnsureSystemPaymentProcessingExpenseCategory.mockClear();
    mockCreateExpense.mockClear();
    mockGetStripeProcessingFeeCentsFromPaymentIntent.mockClear();
    mockGetStripeProcessingFeeCentsFromCharge.mockClear();

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

describe("bookAchReturnFeeExpenseForRentPayment", () => {
  beforeEach(() => {
    mockEnsureSystemPaymentProcessingExpenseCategory.mockClear();
    mockCreateExpense.mockClear();
    mockGetStripeProcessingFeeCentsFromPaymentIntent.mockClear();
    mockGetStripeProcessingFeeCentsFromCharge.mockClear();

    mockGetStripeProcessingFeeCentsFromCharge.mockReturnValue({
      balanceTransactionId: "txn_ach_return",
      feeCents: 400,
    });
    mockCreateExpense.mockResolvedValue(
      makeExpense({
        amount: 4,
        categoryId: "cat-payment-processing",
        categoryName: "Payment processing",
        description: buildAchReturnFeeExpenseDescription("payment-1"),
        expenseDate: "2026-07-22",
        id: "expense-ach-1",
        stripeBalanceTransactionId: "txn_ach_return",
      })
    );
  });

  test("creates ACH return expense from charge stripe_fee", async () => {
    const payment = makePayment({
      id: "payment-1",
      propertyId: "property-1",
      stripePaymentIntentId: "pi_1",
    });
    const charge = {
      balance_transaction: {
        fee_details: [{ amount: 400, type: "stripe_fee" }],
        id: "txn_ach_return",
      },
      id: "ch_failed",
    };

    const expense = await bookAchReturnFeeExpenseForRentPayment(payment, { charge });

    expect(mockGetStripeProcessingFeeCentsFromCharge).toHaveBeenCalledWith(charge);
    expect(mockGetStripeProcessingFeeCentsFromPaymentIntent).not.toHaveBeenCalled();
    expect(mockCreateExpense).toHaveBeenCalledWith("property-1", {
      amount: 4,
      cashExpense: false,
      categoryId: "cat-payment-processing",
      description: "ACH return fee (rent payment payment-1)",
      expenseDate: "2026-07-22",
      stripeBalanceTransactionId: "txn_ach_return",
    });
    expect(expense?.id).toBe("expense-ach-1");
  });

  test("skips when ACH return fee is 0", async () => {
    mockGetStripeProcessingFeeCentsFromCharge.mockReturnValueOnce({
      balanceTransactionId: "txn_zero",
      feeCents: 0,
    });

    const expense = await bookAchReturnFeeExpenseForRentPayment(makePayment(), {
      charge: { balance_transaction: { fee_details: [], id: "txn_zero" }, id: "ch_1" },
    });

    expect(expense).toBeNull();
    expect(mockCreateExpense).not.toHaveBeenCalled();
  });

  test("duplicate ACH return booking is idempotent on balance txn id", async () => {
    const existing = makeExpense({
      amount: 4,
      id: "expense-ach-1",
      stripeBalanceTransactionId: "txn_ach_return",
    });
    mockCreateExpense.mockResolvedValueOnce(existing);
    mockCreateExpense.mockResolvedValueOnce(existing);

    const payment = makePayment({ stripePaymentIntentId: "pi_1" });
    const charge = {
      balance_transaction: {
        fee_details: [{ amount: 400, type: "stripe_fee" }],
        id: "txn_ach_return",
      },
      id: "ch_failed",
    };

    const first = await bookAchReturnFeeExpenseForRentPayment(payment, { charge });
    const second = await bookAchReturnFeeExpenseForRentPayment(payment, { charge });

    expect(first?.id).toBe("expense-ach-1");
    expect(second?.id).toBe("expense-ach-1");
    expect(mockCreateExpense).toHaveBeenCalledTimes(2);
  });
});
