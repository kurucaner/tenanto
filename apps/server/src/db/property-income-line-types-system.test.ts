import { describe, expect, mock, test } from "bun:test";

import { SYSTEM_LEASE_RENT_INCOME_TYPE_NAME } from "@/packages/shared";
import { mockAsyncFn, mockResolved, mockSyncVoid } from "@/test-fixtures/mocks";

interface ICapturedQuery {
  sql: string;
  values: unknown[];
}

const capturedQueries: ICapturedQuery[] = [];

const propertyId = "00000000-0000-4000-8000-000000000001";
const systemTypeId = "00000000-0000-4000-8000-0000000000aa";

const mockClientQuery = mockAsyncFn((sql: string, values?: unknown[]) => {
  capturedQueries.push({ sql, values: values ?? [] });

  if (
    sql.includes("FROM property_income_line_types") &&
    sql.includes("is_system = true") &&
    sql.includes("is_deleted = false") &&
    sql.includes("LIMIT 1")
  ) {
    return Promise.resolve({
      rows: [
        {
          id: systemTypeId,
          name: SYSTEM_LEASE_RENT_INCOME_TYPE_NAME,
          property_id: propertyId,
          sort_order: -1,
        },
      ],
    });
  }

  if (
    sql.includes("FROM property_income_line_types") &&
    sql.includes("is_system = false") &&
    sql.includes("ORDER BY")
  ) {
    return Promise.resolve({ rows: [] });
  }

  if (sql.includes("UPDATE property_income_line_types") && sql.includes("is_deleted = true")) {
    return Promise.resolve({ rows: [] });
  }

  if (sql.includes("UPDATE property_income_line_types") && sql.includes("is_system = false")) {
    return Promise.resolve({ rows: [] });
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

const { propertyIncomeLineTypesDb } = await import("./property-income-line-types");

describe("propertyIncomeLineTypesDb system lease rent type", () => {
  test("findByProperty excludes system types", async () => {
    capturedQueries.length = 0;
    mockClientQuery.mockClear();

    await propertyIncomeLineTypesDb.findByProperty(propertyId, mockClient as never);

    expect(capturedQueries.some((query) => query.sql.includes("is_system = false"))).toBe(true);
  });

  test("replaceAll merges system type id before archiving omitted user types", async () => {
    capturedQueries.length = 0;
    mockClientQuery.mockClear();

    await propertyIncomeLineTypesDb.replaceAll(propertyId, [], mockClient as never);

    const archiveQuery = capturedQueries.find((query) => query.sql.includes("is_deleted = true"));
    expect(archiveQuery?.values?.[1]).toContain(systemTypeId);
    expect(capturedQueries.some((query) => query.sql.includes("DELETE FROM"))).toBe(false);
  });

  test("replaceAll returns empty user-managed list when all misc types are removed", async () => {
    capturedQueries.length = 0;
    mockClientQuery.mockClear();

    const types = await propertyIncomeLineTypesDb.replaceAll(propertyId, [], mockClient as never);

    expect(types).toEqual([]);
  });

  test("ensureLeaseRentIncomeLineType returns active system row", async () => {
    capturedQueries.length = 0;
    mockClientQuery.mockClear();

    const systemType = await propertyIncomeLineTypesDb.ensureLeaseRentIncomeLineType(
      propertyId,
      mockClient as never
    );

    expect(systemType).toEqual({
      id: systemTypeId,
      name: SYSTEM_LEASE_RENT_INCOME_TYPE_NAME,
      propertyId,
      sortOrder: -1,
    });
  });
});
