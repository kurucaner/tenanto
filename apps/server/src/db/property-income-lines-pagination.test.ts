import { describe, expect, mock, test } from "bun:test";

const INCOME_LINE_TYPE_ID = "type0000-0000-4000-8000-000000000001";

const mockQuery = mock((sql: string) => {
  if (sql.includes("COUNT(*)")) {
    return Promise.resolve({
      rows: [{ total_count: 3 }],
    });
  }

  return Promise.resolve({
    rows: [
      {
        amount: "100.00",
        channel_commission: "0.00",
        created_at: new Date("2026-07-09T10:00:00.000Z"),
        deleted_at: null,
        description: null,
        gross_income: "100.00",
        guest_name: null,
        id: "11111111-1111-4111-8111-111111111111",
        income_line_type_id: INCOME_LINE_TYPE_ID,
        income_line_type_name: "Parking",
        is_deleted: false,
        long_stay_id: null,
        net_income: "100.00",
        property_id: "prop-1",
        refunded_at: null,
        refunded_by: null,
        reservation_id: null,
        tax_breakdown: [],
        transaction_date: "2026-07-09",
        unit_id: null,
        updated_at: new Date("2026-07-09T10:00:00.000Z"),
      },
      {
        amount: "50.00",
        channel_commission: "0.00",
        created_at: new Date("2026-07-08T10:00:00.000Z"),
        deleted_at: null,
        description: null,
        gross_income: "50.00",
        guest_name: null,
        id: "22222222-2222-4222-8222-222222222222",
        income_line_type_id: INCOME_LINE_TYPE_ID,
        income_line_type_name: "Parking",
        is_deleted: false,
        long_stay_id: null,
        net_income: "50.00",
        property_id: "prop-1",
        refunded_at: null,
        refunded_by: null,
        reservation_id: null,
        tax_breakdown: [],
        transaction_date: "2026-07-08",
        unit_id: null,
        updated_at: new Date("2026-07-08T10:00:00.000Z"),
      },
      {
        amount: "25.00",
        channel_commission: "0.00",
        created_at: new Date("2026-07-07T10:00:00.000Z"),
        deleted_at: null,
        description: null,
        gross_income: "25.00",
        guest_name: null,
        id: "33333333-3333-4333-8333-333333333333",
        income_line_type_id: INCOME_LINE_TYPE_ID,
        income_line_type_name: "Parking",
        is_deleted: false,
        long_stay_id: null,
        net_income: "25.00",
        property_id: "prop-1",
        refunded_at: null,
        refunded_by: null,
        reservation_id: null,
        tax_breakdown: [],
        transaction_date: "2026-07-07",
        unit_id: null,
        updated_at: new Date("2026-07-07T10:00:00.000Z"),
      },
    ],
  });
});

mock.module("./pool", () => ({
  pool: { query: mockQuery },
}));

const { propertyIncomeLinesDb } = await import("./property-income-lines");

describe("propertyIncomeLinesDb.listPaginatedByProperty", () => {
  test("returns a page and nextCursor when more rows exist", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyIncomeLinesDb.listPaginatedByProperty("prop-1", {}, { limit: 2 });

    expect(firstPage.incomeLines).toHaveLength(2);
    expect(firstPage.incomeLines[0]?.transactionDate).toBe("2026-07-09");
    expect(firstPage.incomeLines[1]?.transactionDate).toBe("2026-07-08");
    expect(firstPage.nextCursor).toBeString();
    expect(firstPage.meta).toEqual({ totalCount: 3 });
    expect(mockQuery.mock.calls).toHaveLength(2);

    const sql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    expect(sql).toContain(
      "ORDER BY pil.transaction_date DESC, pil.created_at DESC, pil.id DESC"
    );
    expect(sql).toContain("LIMIT $");
  });

  test("passes cursor predicate on subsequent pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyIncomeLinesDb.listPaginatedByProperty("prop-1", {}, { limit: 2 });
    expect(firstPage.nextCursor).toBeString();

    mockQuery.mockClear();
    await propertyIncomeLinesDb.listPaginatedByProperty(
      "prop-1",
      {},
      { cursor: firstPage.nextCursor!, limit: 2 }
    );

    const sql = mockQuery.mock.calls[0]?.[0] as string;
    expect(sql).toContain("pil.transaction_date, pil.created_at, pil.id) <");
    expect(mockQuery.mock.calls).toHaveLength(1);
  });

  test("omits meta on cursor pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyIncomeLinesDb.listPaginatedByProperty("prop-1", {}, { limit: 2 });
    expect(firstPage.meta).toBeDefined();

    mockQuery.mockClear();
    const secondPage = await propertyIncomeLinesDb.listPaginatedByProperty(
      "prop-1",
      {},
      { cursor: firstPage.nextCursor!, limit: 2 }
    );

    expect(secondPage.meta).toBeUndefined();
    expect(mockQuery.mock.calls).toHaveLength(1);
  });

  test("applies incomeLineTypeId filter", async () => {
    mockQuery.mockClear();

    await propertyIncomeLinesDb.listPaginatedByProperty(
      "prop-1",
      { incomeLineTypeId: INCOME_LINE_TYPE_ID },
      { limit: 2 }
    );

    const sql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    expect(sql).toContain("pil.income_line_type_id = $");
  });
});
