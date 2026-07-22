import { describe, expect, mock, test } from "bun:test";

import { makeExpense } from "@/test-fixtures/domain/expense";
import { mockAsyncFn, mockResolved, mockSyncVoid } from "@/test-fixtures/mocks";

interface ICapturedQuery {
  sql: string;
  values: unknown[];
}

const capturedQueries: ICapturedQuery[] = [];

const propertyId = "00000000-0000-4000-8000-000000000001";
const categoryId = "00000000-0000-4000-8000-0000000000aa";
const expenseId = "00000000-0000-4000-8000-0000000000bb";
const stripeTxnId = "txn_processing_fee_1";

function expenseRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    amount: "4.66",
    cash_expense: false,
    category_id: categoryId,
    category_name: "Payment processing",
    created_at: new Date("2026-07-22T12:00:00.000Z"),
    deleted_at: null,
    description: "Stripe processing fee",
    expense_date: "2026-07-22",
    id: expenseId,
    is_annual_amount: false,
    is_deleted: false,
    property_id: propertyId,
    stripe_balance_transaction_id: stripeTxnId,
    updated_at: new Date("2026-07-22T12:00:00.000Z"),
    ...overrides,
  };
}

const mockQuery = mockAsyncFn((sql: string, values?: unknown[]) => {
  capturedQueries.push({ sql, values: values ?? [] });
  return Promise.resolve({ rows: [] });
});

mock.module("./pool", () => ({
  pool: {
    connect: mockResolved({
      query: mockQuery,
      release: mockSyncVoid(),
    }),
    query: mockQuery,
  },
}));

const { propertyExpensesDb } = await import("./property-expenses");

describe("propertyExpensesDb stripe balance transaction idempotency", () => {
  test("create inserts stripe_balance_transaction_id", async () => {
    capturedQueries.length = 0;
    mockQuery.mockClear();

    mockQuery.mockImplementation((sql: string, values?: unknown[]): Promise<{ rows: never[] }> => {
      capturedQueries.push({ sql, values: values ?? [] });

      if (sql.includes("INSERT INTO property_expenses")) {
        return Promise.resolve({ rows: [{ id: expenseId }] as never[] });
      }

      if (sql.includes("FROM property_expenses pe") && sql.includes("WHERE pe.id = $1")) {
        return Promise.resolve({ rows: [expenseRow()] as never[] });
      }

      return Promise.resolve({ rows: [] });
    });

    const expense = await propertyExpensesDb.create(propertyId, {
      amount: 4.66,
      cashExpense: false,
      categoryId,
      description: "Stripe processing fee",
      expenseDate: "2026-07-22",
      stripeBalanceTransactionId: stripeTxnId,
    });

    const insert = capturedQueries.find((query) =>
      query.sql.includes("INSERT INTO property_expenses")
    );
    expect(insert?.sql).toContain("stripe_balance_transaction_id");
    expect(insert?.sql).toContain("ON CONFLICT (stripe_balance_transaction_id)");
    expect(insert?.values).toContain(stripeTxnId);
    expect(expense).toEqual(
      makeExpense({
        amount: 4.66,
        categoryId,
        categoryName: "Payment processing",
        createdAt: "2026-07-22T12:00:00.000Z",
        description: "Stripe processing fee",
        expenseDate: "2026-07-22",
        id: expenseId,
        propertyId,
        stripeBalanceTransactionId: stripeTxnId,
        updatedAt: "2026-07-22T12:00:00.000Z",
      })
    );
  });

  test("create conflict on stripe txn id returns existing expense (no-op)", async () => {
    capturedQueries.length = 0;
    mockQuery.mockClear();

    mockQuery.mockImplementation((sql: string, values?: unknown[]): Promise<{ rows: never[] }> => {
      capturedQueries.push({ sql, values: values ?? [] });

      if (sql.includes("INSERT INTO property_expenses")) {
        return Promise.resolve({ rows: [] });
      }

      if (
        sql.includes("FROM property_expenses pe") &&
        sql.includes("stripe_balance_transaction_id = $1")
      ) {
        return Promise.resolve({ rows: [expenseRow()] as never[] });
      }

      return Promise.resolve({ rows: [] });
    });

    const expense = await propertyExpensesDb.create(propertyId, {
      amount: 9.99,
      cashExpense: false,
      categoryId,
      description: "duplicate attempt",
      expenseDate: "2026-07-23",
      stripeBalanceTransactionId: stripeTxnId,
    });

    expect(expense.id).toBe(expenseId);
    expect(expense.stripeBalanceTransactionId).toBe(stripeTxnId);
    expect(expense.amount).toBe(4.66);
    expect(
      capturedQueries.some((query) => query.sql.includes("stripe_balance_transaction_id = $1"))
    ).toBe(true);
  });
});
