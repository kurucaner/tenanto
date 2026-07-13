import { describe, expect, mock, test } from "bun:test";

const CHANNEL_ID = "ch000000-0000-4000-8000-000000000001";

const mockQuery = mock((sql: string) => {
  if (sql.includes("COUNT(*)")) {
    return Promise.resolve({
      rows: [{ total_count: 3 }],
    });
  }

  return Promise.resolve({
    rows: [
      {
        channel_commission: "10.00",
        channel_commission_id: CHANNEL_ID,
        channel_commission_rate: "0.10000",
        channel_name: "Airbnb",
        check_in: "2026-07-09",
        check_out: "2026-07-11",
        cleaning_fee: "0.00",
        created_at: new Date("2026-07-09T10:00:00.000Z"),
        deleted_at: null,
        exclude_cleaning_from_commission_base: false,
        exclude_resort_tax_from_payout: false,
        gross_income: "100.00",
        guest_name: "Guest A",
        id: "11111111-1111-4111-8111-111111111111",
        is_deleted: false,
        net_income: "90.00",
        nights: 2,
        property_id: "prop-1",
        refunded_at: null,
        refunded_by: null,
        reservation_number: null,
        room_total: "100.00",
        status: "stayed",
        tax_breakdown: [],
        unit_id: "unit-1",
        updated_at: new Date("2026-07-09T10:00:00.000Z"),
      },
      {
        channel_commission: "5.00",
        channel_commission_id: CHANNEL_ID,
        channel_commission_rate: "0.10000",
        channel_name: "Airbnb",
        check_in: "2026-07-08",
        check_out: "2026-07-10",
        cleaning_fee: "0.00",
        created_at: new Date("2026-07-08T10:00:00.000Z"),
        deleted_at: null,
        exclude_cleaning_from_commission_base: false,
        exclude_resort_tax_from_payout: false,
        gross_income: "50.00",
        guest_name: "Guest B",
        id: "22222222-2222-4222-8222-222222222222",
        is_deleted: false,
        net_income: "45.00",
        nights: 2,
        property_id: "prop-1",
        refunded_at: null,
        refunded_by: null,
        reservation_number: null,
        room_total: "50.00",
        status: "stayed",
        tax_breakdown: [],
        unit_id: "unit-1",
        updated_at: new Date("2026-07-08T10:00:00.000Z"),
      },
      {
        channel_commission: "2.50",
        channel_commission_id: CHANNEL_ID,
        channel_commission_rate: "0.10000",
        channel_name: "Airbnb",
        check_in: "2026-07-07",
        check_out: "2026-07-08",
        cleaning_fee: "0.00",
        created_at: new Date("2026-07-07T10:00:00.000Z"),
        deleted_at: null,
        exclude_cleaning_from_commission_base: false,
        exclude_resort_tax_from_payout: false,
        gross_income: "25.00",
        guest_name: "Guest C",
        id: "33333333-3333-4333-8333-333333333333",
        is_deleted: false,
        net_income: "22.50",
        nights: 1,
        property_id: "prop-1",
        refunded_at: null,
        refunded_by: null,
        reservation_number: null,
        room_total: "25.00",
        status: "stayed",
        tax_breakdown: [],
        unit_id: "unit-1",
        updated_at: new Date("2026-07-07T10:00:00.000Z"),
      },
    ],
  });
});

mock.module("./pool", () => ({
  pool: { query: mockQuery },
}));

const { propertyReservationsDb } = await import("./property-reservations");

describe("propertyReservationsDb.listPaginatedByProperty", () => {
  test("returns a page and nextCursor when more rows exist", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyReservationsDb.listPaginatedByProperty(
      "prop-1",
      {},
      { limit: 2 }
    );

    expect(firstPage.shortStays).toHaveLength(2);
    expect(firstPage.shortStays[0]?.checkIn).toBe("2026-07-09");
    expect(firstPage.shortStays[1]?.checkIn).toBe("2026-07-08");
    expect(firstPage.nextCursor).toBeString();
    expect(firstPage.meta).toEqual({ totalCount: 3 });
    expect(mockQuery.mock.calls).toHaveLength(2);

    const sql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    expect(sql).toContain("ORDER BY pr.check_in DESC, pr.created_at DESC, pr.id DESC");
    expect(sql).toContain("LIMIT $");
  });

  test("passes cursor predicate on subsequent pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyReservationsDb.listPaginatedByProperty(
      "prop-1",
      {},
      { limit: 2 }
    );
    expect(firstPage.nextCursor).toBeString();

    mockQuery.mockClear();
    await propertyReservationsDb.listPaginatedByProperty(
      "prop-1",
      {},
      { cursor: firstPage.nextCursor!, limit: 2 }
    );

    const sql = mockQuery.mock.calls[0]?.[0] as string;
    expect(sql).toContain("pr.check_in, pr.created_at, pr.id) <");
    expect(mockQuery.mock.calls).toHaveLength(1);
  });

  test("omits meta on cursor pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyReservationsDb.listPaginatedByProperty(
      "prop-1",
      {},
      { limit: 2 }
    );
    expect(firstPage.meta).toBeDefined();

    mockQuery.mockClear();
    const secondPage = await propertyReservationsDb.listPaginatedByProperty(
      "prop-1",
      {},
      { cursor: firstPage.nextCursor!, limit: 2 }
    );

    expect(secondPage.meta).toBeUndefined();
    expect(mockQuery.mock.calls).toHaveLength(1);
  });

  test("applies status filter", async () => {
    mockQuery.mockClear();

    await propertyReservationsDb.listPaginatedByProperty(
      "prop-1",
      { status: "stayed" },
      { limit: 2 }
    );

    const sql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    expect(sql).toContain("pr.status = $");
  });

  test("applies search filter on guest, channel, and unit", async () => {
    mockQuery.mockClear();

    await propertyReservationsDb.listPaginatedByProperty("prop-1", { q: "alex" }, { limit: 2 });

    const sql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    expect(sql).toContain("pr.guest_name ILIKE");
    expect(sql).toContain("pcc.name ILIKE");
    expect(sql).toContain("pu.unit_number ILIKE");
  });

  test("applies refundStatus filter", async () => {
    mockQuery.mockClear();

    await propertyReservationsDb.listPaginatedByProperty(
      "prop-1",
      { refundStatus: "refunded" },
      { limit: 2 }
    );

    const listSql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    expect(listSql).toContain("pr.refunded_at IS NOT NULL");

    const countSql = mockQuery.mock.calls.find(([query]) =>
      (query as string).includes("COUNT(*)")
    )?.[0] as string;
    expect(countSql).toContain("pr.refunded_at IS NOT NULL");
  });
});
