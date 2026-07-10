import { describe, expect, mock, test } from "bun:test";

const CATEGORY_ID_1 = "cat00000-0000-4000-8000-000000000001";
const CATEGORY_ID_2 = "cat00000-0000-4000-8000-000000000002";

const mockQuery = mock(() =>
  Promise.resolve({
    rows: [
      {
        amount: "100.00",
        category_id: CATEGORY_ID_1,
        category_name: "Cleaning",
        created_at: new Date("2026-07-09T10:00:00.000Z"),
        deleted_at: null,
        description: "Older same date",
        expense_date: "2026-07-09",
        id: "11111111-1111-4111-8111-111111111111",
        is_annual_amount: false,
        is_deleted: false,
        property_id: "prop-1",
        tax_free: false,
        updated_at: new Date("2026-07-09T10:00:00.000Z"),
      },
      {
        amount: "50.00",
        category_id: CATEGORY_ID_2,
        category_name: "Other",
        created_at: new Date("2026-07-08T10:00:00.000Z"),
        deleted_at: null,
        description: "Earlier date",
        expense_date: "2026-07-08",
        id: "22222222-2222-4222-8222-222222222222",
        is_annual_amount: false,
        is_deleted: false,
        property_id: "prop-1",
        tax_free: false,
        updated_at: new Date("2026-07-08T10:00:00.000Z"),
      },
      {
        amount: "25.00",
        category_id: CATEGORY_ID_2,
        category_name: "Other",
        created_at: new Date("2026-07-07T10:00:00.000Z"),
        deleted_at: null,
        description: "No date",
        expense_date: null,
        id: "33333333-3333-4333-8333-333333333333",
        is_annual_amount: false,
        is_deleted: false,
        property_id: "prop-1",
        tax_free: false,
        updated_at: new Date("2026-07-07T10:00:00.000Z"),
      },
    ],
  })
);

mock.module("./pool", () => ({
  pool: { query: mockQuery },
}));

const { propertyExpensesDb } = await import("./property-expenses");

describe("propertyExpensesDb.listPaginatedByProperty", () => {
  test("returns a page and nextCursor when more rows exist", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyExpensesDb.listPaginatedByProperty("prop-1", {}, { limit: 2 });

    expect(firstPage.expenses).toHaveLength(2);
    expect(firstPage.expenses[0]?.expenseDate).toBe("2026-07-09");
    expect(firstPage.expenses[1]?.expenseDate).toBe("2026-07-08");
    expect(firstPage.nextCursor).toBeString();

    const sql = mockQuery.mock.calls[0]?.[0] as string;
    expect(sql).toContain("COALESCE(pe.expense_date");
    expect(sql).toContain("LIMIT $");
  });

  test("passes cursor predicate on subsequent pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyExpensesDb.listPaginatedByProperty("prop-1", {}, { limit: 2 });
    expect(firstPage.nextCursor).toBeString();

    mockQuery.mockClear();
    await propertyExpensesDb.listPaginatedByProperty(
      "prop-1",
      {},
      { cursor: firstPage.nextCursor!, limit: 2 }
    );

    const sql = mockQuery.mock.calls[0]?.[0] as string;
    expect(sql).toContain("pe.created_at, pe.id) <");
  });
});
