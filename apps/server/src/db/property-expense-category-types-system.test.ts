import { describe, expect, mock, test } from "bun:test";

import { SYSTEM_PAYMENT_PROCESSING_EXPENSE_CATEGORY_NAME } from "@/packages/shared";
import { mockAsyncFn, mockResolved, mockSyncVoid } from "@/test-fixtures/mocks";

interface ICapturedQuery {
  sql: string;
  values: unknown[];
}

const capturedQueries: ICapturedQuery[] = [];

const propertyId = "00000000-0000-4000-8000-000000000001";
const systemCategoryId = "00000000-0000-4000-8000-0000000000cc";

function isActiveSystemNameLookup(sql: string): boolean {
  return (
    sql.includes("FROM property_expense_category_types") &&
    sql.includes("is_system = true") &&
    sql.includes("is_deleted = false") &&
    sql.includes("lower(name) = $2") &&
    sql.includes("LIMIT 1")
  );
}

function systemCategoryRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: systemCategoryId,
    is_annual_amount: false,
    is_system: true,
    name: SYSTEM_PAYMENT_PROCESSING_EXPENSE_CATEGORY_NAME,
    property_id: propertyId,
    sort_order: -1,
    ...overrides,
  };
}

const mockClientQuery = mockAsyncFn((sql: string, values?: unknown[]) => {
  capturedQueries.push({ sql, values: values ?? [] });

  if (isActiveSystemNameLookup(sql)) {
    return Promise.resolve({ rows: [systemCategoryRow()] });
  }

  if (sql.includes("UPDATE property_expense_category_types") && sql.includes("is_deleted = true")) {
    return Promise.resolve({ rows: [] });
  }

  if (sql.includes("INSERT INTO property_expense_category_types")) {
    return Promise.resolve({ rows: [systemCategoryRow()] });
  }

  return Promise.resolve({ rows: [] });
});

const mockClient = {
  query: mockClientQuery,
  release: mockSyncVoid(),
};

mock.module("./pool", () => ({
  pool: {
    connect: mockResolved(mockClient),
  },
}));

const { propertyExpenseCategoryTypesDb } = await import("./property-expense-category-types");

describe("propertyExpenseCategoryTypesDb system Payment processing", () => {
  test("ensureSystemPaymentProcessingExpenseCategory returns active system row", async () => {
    capturedQueries.length = 0;
    mockClientQuery.mockClear();

    const category =
      await propertyExpenseCategoryTypesDb.ensureSystemPaymentProcessingExpenseCategory(
        propertyId,
        mockClient as never
      );

    expect(category).toEqual({
      id: systemCategoryId,
      isAnnualAmount: false,
      isSystem: true,
      name: SYSTEM_PAYMENT_PROCESSING_EXPENSE_CATEGORY_NAME,
      propertyId,
      sortOrder: -1,
    });
    const lookup = capturedQueries.find((query) => isActiveSystemNameLookup(query.sql));
    expect(lookup?.values).toEqual([
      propertyId,
      SYSTEM_PAYMENT_PROCESSING_EXPENSE_CATEGORY_NAME.toLowerCase(),
    ]);
    expect(capturedQueries.some((query) => query.sql.includes("INSERT INTO"))).toBe(false);
  });

  test("ensure twice uses the same active row without inserting", async () => {
    capturedQueries.length = 0;
    mockClientQuery.mockClear();

    const first = await propertyExpenseCategoryTypesDb.ensureSystemPaymentProcessingExpenseCategory(
      propertyId,
      mockClient as never
    );
    const second =
      await propertyExpenseCategoryTypesDb.ensureSystemPaymentProcessingExpenseCategory(
        propertyId,
        mockClient as never
      );

    expect(first.id).toBe(systemCategoryId);
    expect(second.id).toBe(systemCategoryId);
    expect(second.name).toBe(SYSTEM_PAYMENT_PROCESSING_EXPENSE_CATEGORY_NAME);
    expect(capturedQueries.filter((query) => query.sql.includes("INSERT INTO")).length).toBe(0);
  });

  test("ensure inserts when missing", async () => {
    capturedQueries.length = 0;
    mockClientQuery.mockClear();

    mockClientQuery.mockImplementation((sql: string, values?: unknown[]) => {
      capturedQueries.push({ sql, values: values ?? [] });

      if (isActiveSystemNameLookup(sql)) {
        return Promise.resolve({ rows: [] });
      }

      if (
        sql.includes("UPDATE property_expense_category_types") &&
        sql.includes("is_deleted = true")
      ) {
        return Promise.resolve({ rows: [] });
      }

      if (sql.includes("INSERT INTO property_expense_category_types")) {
        return Promise.resolve({ rows: [systemCategoryRow()] });
      }

      return Promise.resolve({ rows: [] });
    });

    const category =
      await propertyExpenseCategoryTypesDb.ensureSystemPaymentProcessingExpenseCategory(
        propertyId,
        mockClient as never
      );

    expect(category).toEqual({
      id: systemCategoryId,
      isAnnualAmount: false,
      isSystem: true,
      name: SYSTEM_PAYMENT_PROCESSING_EXPENSE_CATEGORY_NAME,
      propertyId,
      sortOrder: -1,
    });
    expect(
      capturedQueries.some(
        (query) =>
          query.sql.includes("INSERT INTO property_expense_category_types") &&
          query.sql.includes("true") &&
          query.values.includes(SYSTEM_PAYMENT_PROCESSING_EXPENSE_CATEGORY_NAME) &&
          query.values.includes(-1)
      )
    ).toBe(true);
  });

  test("ensure restores archived row by name and sets is_system", async () => {
    capturedQueries.length = 0;
    mockClientQuery.mockClear();

    mockClientQuery.mockImplementation((sql: string, values?: unknown[]) => {
      capturedQueries.push({ sql, values: values ?? [] });

      if (isActiveSystemNameLookup(sql)) {
        return Promise.resolve({ rows: [] });
      }

      if (
        sql.includes("UPDATE property_expense_category_types") &&
        sql.includes("is_deleted = true")
      ) {
        return Promise.resolve({ rows: [systemCategoryRow()] });
      }

      return Promise.resolve({ rows: [] });
    });

    const category =
      await propertyExpenseCategoryTypesDb.ensureSystemPaymentProcessingExpenseCategory(
        propertyId,
        mockClient as never
      );

    expect(category.id).toBe(systemCategoryId);
    const restore = capturedQueries.find(
      (query) =>
        query.sql.includes("UPDATE property_expense_category_types") &&
        query.sql.includes("is_system = true") &&
        query.sql.includes("is_deleted = true")
    );
    expect(restore).toBeDefined();
    expect(restore?.values).toEqual([
      SYSTEM_PAYMENT_PROCESSING_EXPENSE_CATEGORY_NAME,
      -1,
      propertyId,
      SYSTEM_PAYMENT_PROCESSING_EXPENSE_CATEGORY_NAME.toLowerCase(),
    ]);
    expect(capturedQueries.some((query) => query.sql.includes("INSERT INTO"))).toBe(false);
  });

  test("seedDefaults ensures system category then seeds user defaults when empty", async () => {
    capturedQueries.length = 0;
    mockClientQuery.mockClear();

    mockClientQuery.mockImplementation((sql: string, values?: unknown[]) => {
      capturedQueries.push({ sql, values: values ?? [] });

      if (isActiveSystemNameLookup(sql)) {
        return Promise.resolve({ rows: [systemCategoryRow()] });
      }

      if (sql.includes("AND is_system = false") && sql.includes("EXISTS")) {
        return Promise.resolve({ rows: [{ exists: false }] });
      }

      if (sql.includes("INSERT INTO property_expense_category_types")) {
        return Promise.resolve({ rows: [] });
      }

      return Promise.resolve({ rows: [] });
    });

    await propertyExpenseCategoryTypesDb.seedDefaults(propertyId, mockClient as never);

    expect(capturedQueries.some((query) => isActiveSystemNameLookup(query.sql))).toBe(true);
    expect(
      capturedQueries.some(
        (query) =>
          query.sql.includes("INSERT INTO property_expense_category_types") &&
          query.values.includes(false) &&
          query.values.includes("Cleaning")
      )
    ).toBe(true);
  });

  test("replaceAll merges system id before archive and skips system updates", async () => {
    capturedQueries.length = 0;
    mockClientQuery.mockClear();

    mockClientQuery.mockImplementation((sql: string, values?: unknown[]) => {
      capturedQueries.push({ sql, values: values ?? [] });

      if (isActiveSystemNameLookup(sql)) {
        return Promise.resolve({ rows: [systemCategoryRow()] });
      }

      if (sql.includes("SET is_deleted = true")) {
        return Promise.resolve({ rows: [] });
      }

      if (
        sql.includes("UPDATE property_expense_category_types") &&
        sql.includes("is_system = false")
      ) {
        return Promise.resolve({ rows: [] });
      }

      if (
        sql.includes("FROM property_expense_category_types") &&
        sql.includes("ORDER BY sort_order")
      ) {
        return Promise.resolve({ rows: [systemCategoryRow()] });
      }

      return Promise.resolve({ rows: [] });
    });

    const types = await propertyExpenseCategoryTypesDb.replaceAll(
      propertyId,
      [],
      mockClient as never
    );

    const archiveQuery = capturedQueries.find((query) =>
      query.sql.includes("SET is_deleted = true")
    );
    expect(archiveQuery?.values?.[1]).toContain(systemCategoryId);
    expect(archiveQuery?.sql).toContain("is_system = false");
    expect(
      capturedQueries.some(
        (query) =>
          query.sql.includes("UPDATE property_expense_category_types") &&
          query.sql.includes("is_system = false") &&
          query.sql.includes("sort_order")
      )
    ).toBe(false);
    expect(types).toEqual([
      {
        id: systemCategoryId,
        isAnnualAmount: false,
        isSystem: true,
        name: SYSTEM_PAYMENT_PROCESSING_EXPENSE_CATEGORY_NAME,
        propertyId,
        sortOrder: -1,
      },
    ]);
  });
});
