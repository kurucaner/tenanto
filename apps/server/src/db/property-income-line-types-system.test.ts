import { describe, expect, mock, test } from "bun:test";

import {
  SYSTEM_LEASE_RENT_INCOME_TYPE_NAME,
  SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME,
} from "@/packages/shared";
import { mockAsyncFn, mockResolved, mockSyncVoid } from "@/test-fixtures/mocks";

interface ICapturedQuery {
  sql: string;
  values: unknown[];
}

const capturedQueries: ICapturedQuery[] = [];

const propertyId = "00000000-0000-4000-8000-000000000001";
const rentTypeId = "00000000-0000-4000-8000-0000000000aa";
const depositTypeId = "00000000-0000-4000-8000-0000000000bb";

function isActiveSystemNameLookup(sql: string): boolean {
  return (
    sql.includes("FROM property_income_line_types") &&
    sql.includes("is_system = true") &&
    sql.includes("is_deleted = false") &&
    sql.includes("lower(name) = ANY") &&
    sql.includes("LIMIT 1")
  );
}

const mockClientQuery = mockAsyncFn((sql: string, values?: unknown[]) => {
  capturedQueries.push({ sql, values: values ?? [] });

  if (isActiveSystemNameLookup(sql)) {
    const names = (values?.[1] as string[] | undefined) ?? [];
    if (names.includes(SYSTEM_LEASE_RENT_INCOME_TYPE_NAME.toLowerCase())) {
      return Promise.resolve({
        rows: [
          {
            id: rentTypeId,
            name: SYSTEM_LEASE_RENT_INCOME_TYPE_NAME,
            property_id: propertyId,
            sort_order: -1,
          },
        ],
      });
    }
    if (names.includes(SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME.toLowerCase())) {
      return Promise.resolve({
        rows: [
          {
            id: depositTypeId,
            name: SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME,
            property_id: propertyId,
            sort_order: -2,
          },
        ],
      });
    }
    return Promise.resolve({ rows: [] });
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

  if (sql.includes("INSERT INTO property_income_line_types")) {
    return Promise.resolve({
      rows: [
        {
          id: rentTypeId,
          name: values?.[1],
          property_id: propertyId,
          sort_order: values?.[2],
        },
      ],
    });
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

describe("propertyIncomeLineTypesDb system income types", () => {
  test("findByProperty excludes system types", async () => {
    capturedQueries.length = 0;
    mockClientQuery.mockClear();

    await propertyIncomeLineTypesDb.findByProperty(propertyId, mockClient as never);

    expect(capturedQueries.some((query) => query.sql.includes("is_system = false"))).toBe(true);
  });

  test("replaceAll merges rent and deposit system type ids before archiving", async () => {
    capturedQueries.length = 0;
    mockClientQuery.mockClear();

    await propertyIncomeLineTypesDb.replaceAll(propertyId, [], mockClient as never);

    const archiveQuery = capturedQueries.find((query) => query.sql.includes("is_deleted = true"));
    expect(archiveQuery?.values?.[1]).toContain(rentTypeId);
    expect(archiveQuery?.values?.[1]).toContain(depositTypeId);
    expect(archiveQuery?.sql).toContain("is_system = false");
    expect(capturedQueries.some((query) => query.sql.includes("DELETE FROM"))).toBe(false);
  });

  test("replaceAll returns empty user-managed list when all misc types are removed", async () => {
    capturedQueries.length = 0;
    mockClientQuery.mockClear();

    const types = await propertyIncomeLineTypesDb.replaceAll(propertyId, [], mockClient as never);

    expect(types).toEqual([]);
  });

  test("ensureLeaseRentIncomeLineType returns active rent system row by name", async () => {
    capturedQueries.length = 0;
    mockClientQuery.mockClear();

    const systemType = await propertyIncomeLineTypesDb.ensureLeaseRentIncomeLineType(
      propertyId,
      mockClient as never
    );

    expect(systemType).toEqual({
      id: rentTypeId,
      name: SYSTEM_LEASE_RENT_INCOME_TYPE_NAME,
      propertyId,
      sortOrder: -1,
    });
    const lookup = capturedQueries.find((query) => isActiveSystemNameLookup(query.sql));
    expect(lookup?.values?.[1]).toEqual([
      SYSTEM_LEASE_RENT_INCOME_TYPE_NAME.toLowerCase(),
      "rent",
    ]);
  });

  test("ensureLeaseDepositIncomeLineType returns active deposit system row", async () => {
    capturedQueries.length = 0;
    mockClientQuery.mockClear();

    const systemType = await propertyIncomeLineTypesDb.ensureLeaseDepositIncomeLineType(
      propertyId,
      mockClient as never
    );

    expect(systemType).toEqual({
      id: depositTypeId,
      name: SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME,
      propertyId,
      sortOrder: -2,
    });
    const lookup = capturedQueries.find((query) => isActiveSystemNameLookup(query.sql));
    expect(lookup?.values?.[1]).toEqual([SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME.toLowerCase()]);
  });

  test("ensureSystemIncomeLineTypes returns both rent and deposit", async () => {
    capturedQueries.length = 0;
    mockClientQuery.mockClear();

    const systemTypes = await propertyIncomeLineTypesDb.ensureSystemIncomeLineTypes(
      propertyId,
      mockClient as never
    );

    expect(systemTypes.rent.id).toBe(rentTypeId);
    expect(systemTypes.deposit.id).toBe(depositTypeId);
  });

  test("ensureLeaseRentIncomeLineType inserts rent when missing", async () => {
    capturedQueries.length = 0;
    mockClientQuery.mockClear();

    mockClientQuery.mockImplementation((sql: string, values?: unknown[]) => {
      capturedQueries.push({ sql, values: values ?? [] });

      if (isActiveSystemNameLookup(sql)) {
        return Promise.resolve({ rows: [] });
      }

      if (sql.includes("UPDATE property_income_line_types") && sql.includes("is_deleted = true")) {
        return Promise.resolve({ rows: [] });
      }

      if (sql.includes("INSERT INTO property_income_line_types")) {
        return Promise.resolve({
          rows: [
            {
              id: rentTypeId,
              name: SYSTEM_LEASE_RENT_INCOME_TYPE_NAME,
              property_id: propertyId,
              sort_order: -1,
            },
          ],
        });
      }

      return Promise.resolve({ rows: [] });
    });

    const systemType = await propertyIncomeLineTypesDb.ensureLeaseRentIncomeLineType(
      propertyId,
      mockClient as never
    );

    expect(systemType).toEqual({
      id: rentTypeId,
      name: SYSTEM_LEASE_RENT_INCOME_TYPE_NAME,
      propertyId,
      sortOrder: -1,
    });
    expect(
      capturedQueries.some(
        (query) =>
          query.sql.includes("INSERT INTO property_income_line_types") &&
          query.values.includes(SYSTEM_LEASE_RENT_INCOME_TYPE_NAME)
      )
    ).toBe(true);
  });
});
