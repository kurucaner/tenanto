import { describe, expect, mock, test } from "bun:test";

import {
  IncomeEntryKind,
  type IPropertyIncomeLine,
  type IPropertyReservation,
  type TPropertyIncomeEntry,
} from "@/packages/shared";

const CHANNEL_ID = "ch000000-0000-4000-8000-000000000001";
const LINE_TYPE_ID = "ilt00000-0000-4000-8000-000000000001";

const stayRowA: Record<string, unknown> = {
  channel_commission: "10.00",
  channel_commission_id: CHANNEL_ID,
  channel_commission_rate: "0.10000",
  channel_name: "Airbnb",
  check_in: "2026-07-10",
  check_out: "2026-07-12",
  cleaning_fee: "0.00",
  created_at: new Date("2026-07-10T10:00:00.000Z"),
  deleted_at: null,
  exclude_cleaning_from_commission_base: false,
  exclude_resort_tax_from_payout: false,
  gross_income: "100.00",
  guest_name: "Guest Stay",
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
  updated_at: new Date("2026-07-10T10:00:00.000Z"),
};

const stayRowB: Record<string, unknown> = {
  ...stayRowA,
  check_in: "2026-07-09",
  check_out: "2026-07-11",
  created_at: new Date("2026-07-09T10:00:00.000Z"),
  guest_name: "Guest Stay B",
  id: "22222222-2222-4222-8222-222222222222",
  updated_at: new Date("2026-07-09T10:00:00.000Z"),
};

const lineRowA: Record<string, unknown> = {
  amount: "25.00",
  channel_commission: "0.00",
  created_at: new Date("2026-07-09T15:00:00.000Z"),
  deleted_at: null,
  description: null,
  gross_income: "25.00",
  guest_name: null,
  id: "33333333-3333-4333-8333-333333333333",
  income_line_type_id: LINE_TYPE_ID,
  income_line_type_name: "Parking",
  is_deleted: false,
  long_stay_id: null,
  net_income: "25.00",
  property_id: "prop-1",
  refunded_at: null,
  refunded_by: null,
  reservation_id: null,
  tax_breakdown: [],
  transaction_date: "2026-07-09",
  unit_id: null,
  updated_at: new Date("2026-07-09T15:00:00.000Z"),
};

const lineRowB: Record<string, unknown> = {
  ...lineRowA,
  amount: "15.00",
  created_at: new Date("2026-07-08T10:00:00.000Z"),
  gross_income: "15.00",
  id: "44444444-4444-4444-8444-444444444444",
  net_income: "15.00",
  transaction_date: "2026-07-08",
  updated_at: new Date("2026-07-08T10:00:00.000Z"),
};

const mergedRowsCanonical = [
  {
    created_at: stayRowA.created_at,
    entry_kind: IncomeEntryKind.STAY,
    id: stayRowA.id,
    row_payload: stayRowA,
    sort_key_date: stayRowA.check_in,
    sort_key_num: null,
    sort_key_text: null,
  },
  {
    created_at: lineRowA.created_at,
    entry_kind: IncomeEntryKind.LINE,
    id: lineRowA.id,
    row_payload: lineRowA,
    sort_key_date: lineRowA.transaction_date,
    sort_key_num: null,
    sort_key_text: null,
  },
  {
    created_at: stayRowB.created_at,
    entry_kind: IncomeEntryKind.STAY,
    id: stayRowB.id,
    row_payload: stayRowB,
    sort_key_date: stayRowB.check_in,
    sort_key_num: null,
    sort_key_text: null,
  },
  {
    created_at: lineRowB.created_at,
    entry_kind: IncomeEntryKind.LINE,
    id: lineRowB.id,
    row_payload: lineRowB,
    sort_key_date: lineRowB.transaction_date,
    sort_key_num: null,
    sort_key_text: null,
  },
];

function rowIsBeforeDateCursor(
  row: (typeof mergedRowsCanonical)[number],
  sortKeyDate: string,
  createdAt: string,
  id: string,
  entryKind: string
): boolean {
  const rowSortDate = String(row.sort_key_date).slice(0, 10);
  const rowCreatedAt =
    row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at);
  if (rowSortDate !== sortKeyDate) return rowSortDate < sortKeyDate;
  if (rowCreatedAt !== createdAt) return rowCreatedAt < createdAt;
  if (String(row.id) !== id) return String(row.id) < id;
  return String(row.entry_kind) < entryKind;
}

const mockQuery = mock((sql: string, values?: unknown[]) => {
  if (sql.includes("COUNT(*)")) {
    return Promise.resolve({
      rows: [{ total_count: 2 }],
    });
  }

  let rows = [...mergedRowsCanonical];

  if (sql.includes("entry_kind) <") && values) {
    const entryKind = values[values.length - 2] as string;
    const id = values[values.length - 3] as string;
    const createdAt = values[values.length - 4] as string;
    const sortKey = values[values.length - 5] as string;
    rows = rows.filter((row) => rowIsBeforeDateCursor(row, sortKey, createdAt, id, entryKind));
  }

  const limitPlusOne = (values?.[values.length - 1] as number | undefined) ?? mergedRowsCanonical.length;

  return Promise.resolve({ rows: rows.slice(0, limitPlusOne) });
});

mock.module("./pool", () => ({
  pool: { query: mockQuery },
}));

const { propertyIncomeEntriesDb } = await import("./property-income-entries");
const { mapPropertyIncomeLineRow, mapPropertyReservationRow } = await import("./mappers");

function buildMergedEntries(
  reservations: IPropertyReservation[],
  incomeLines: IPropertyIncomeLine[],
  incomeTypeFilter: string
): TPropertyIncomeEntry[] {
  const entries: TPropertyIncomeEntry[] = [];
  const showStays = incomeTypeFilter === "" || incomeTypeFilter === IncomeEntryKind.STAY;
  const showLines = incomeTypeFilter === "" || incomeTypeFilter !== IncomeEntryKind.STAY;

  if (showStays) {
    for (const stay of reservations) {
      entries.push({ entryKind: IncomeEntryKind.STAY, stay });
    }
  }

  if (showLines) {
    for (const line of incomeLines) {
      if (incomeTypeFilter === "" || line.incomeLineTypeId === incomeTypeFilter) {
        entries.push({ entryKind: IncomeEntryKind.LINE, line });
      }
    }
  }

  return entries;
}

function getEntrySortDate(entry: TPropertyIncomeEntry): string {
  return entry.entryKind === IncomeEntryKind.STAY ? entry.stay.checkIn : entry.line.transactionDate;
}

function getEntryCreatedAt(entry: TPropertyIncomeEntry): string {
  return entry.entryKind === IncomeEntryKind.STAY ? entry.stay.createdAt : entry.line.createdAt;
}

function getEntryId(entry: TPropertyIncomeEntry): string {
  return entry.entryKind === IncomeEntryKind.STAY ? entry.stay.id : entry.line.id;
}

function referenceSortDateDesc(entries: TPropertyIncomeEntry[]): TPropertyIncomeEntry[] {
  return [...entries].sort((a, b) => {
    const sortDateCmp = getEntrySortDate(b).localeCompare(getEntrySortDate(a));
    if (sortDateCmp !== 0) return sortDateCmp;
    const createdCmp = getEntryCreatedAt(b).localeCompare(getEntryCreatedAt(a));
    if (createdCmp !== 0) return createdCmp;
    const idCmp = getEntryId(b).localeCompare(getEntryId(a));
    if (idCmp !== 0) return idCmp;
    return b.entryKind.localeCompare(a.entryKind);
  });
}

function getEntryKey(entry: TPropertyIncomeEntry): string {
  return entry.entryKind === IncomeEntryKind.STAY ? `stay:${entry.stay.id}` : `line:${entry.line.id}`;
}

describe("propertyIncomeEntriesDb.listPaginatedByProperty", () => {
  test("returns a merged page and nextCursor when more rows exist", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyIncomeEntriesDb.listPaginatedByProperty("prop-1", {}, { limit: 2 });

    expect(firstPage.entries).toHaveLength(2);
    expect(firstPage.entries[0]?.entryKind).toBe(IncomeEntryKind.STAY);
    expect(
      firstPage.entries[0]?.entryKind === IncomeEntryKind.STAY
        ? firstPage.entries[0].stay.checkIn
        : null
    ).toBe("2026-07-10");
    expect(firstPage.nextCursor).toBeString();
    expect(firstPage.meta).toEqual({ totalCount: 4 });
    expect(mockQuery.mock.calls).toHaveLength(3);

    const sql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    expect(sql).toContain("UNION ALL");
    expect(sql).toContain("ORDER BY merged.sort_key_date DESC");
    expect(sql).toContain("LIMIT $");
  });

  test("orders by numeric sort column when sortBy is net", async () => {
    mockQuery.mockClear();

    await propertyIncomeEntriesDb.listPaginatedByProperty(
      "prop-1",
      { sortBy: "net", sortDir: "desc" },
      { limit: 2 }
    );

    const sql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    expect(sql).toContain("ORDER BY merged.sort_key_num DESC");
  });

  test("passes cursor predicate on subsequent pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyIncomeEntriesDb.listPaginatedByProperty("prop-1", {}, { limit: 2 });
    expect(firstPage.nextCursor).toBeString();

    mockQuery.mockClear();
    await propertyIncomeEntriesDb.listPaginatedByProperty(
      "prop-1",
      {},
      { cursor: firstPage.nextCursor!, limit: 2 }
    );

    const sql = mockQuery.mock.calls[0]?.[0] as string;
    expect(sql).toContain("merged.sort_key_date, merged.created_at, merged.id, merged.entry_kind) <");
    expect(mockQuery.mock.calls).toHaveLength(1);
  });

  test("omits meta on cursor pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyIncomeEntriesDb.listPaginatedByProperty("prop-1", {}, { limit: 2 });
    expect(firstPage.meta).toBeDefined();

    mockQuery.mockClear();
    const secondPage = await propertyIncomeEntriesDb.listPaginatedByProperty(
      "prop-1",
      {},
      { cursor: firstPage.nextCursor!, limit: 2 }
    );

    expect(secondPage.meta).toBeUndefined();
    expect(mockQuery.mock.calls).toHaveLength(1);
  });

  test("applies stay-only incomeType filter in SQL", async () => {
    mockQuery.mockClear();

    await propertyIncomeEntriesDb.listPaginatedByProperty(
      "prop-1",
      { incomeType: IncomeEntryKind.STAY },
      { limit: 2 }
    );

    const sql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    expect(sql).toContain("property_reservations pr");
    expect(sql).not.toContain("property_income_lines pil");
  });

  test("applies line-type incomeType filter in SQL", async () => {
    mockQuery.mockClear();

    await propertyIncomeEntriesDb.listPaginatedByProperty(
      "prop-1",
      { incomeType: LINE_TYPE_ID },
      { limit: 2 }
    );

    const sql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    expect(sql).toContain("property_income_lines pil");
    expect(sql).not.toContain("property_reservations pr");
    expect(sql).toContain("pil.income_line_type_id = $");
  });

  test("cursor pages have no duplicates or gaps", async () => {
    mockQuery.mockClear();

    const collected: TPropertyIncomeEntry[] = [];
    let cursor: string | undefined;
    let guard = 0;

    while (guard < 10) {
      const page = await propertyIncomeEntriesDb.listPaginatedByProperty(
        "prop-1",
        {},
        { cursor, limit: 1 }
      );
      collected.push(...page.entries);
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
      guard += 1;
    }

    expect(collected).toHaveLength(4);
    expect(new Set(collected.map(getEntryKey)).size).toBe(4);
  });

  test("matches merged client ordering for date desc", async () => {
    mockQuery.mockClear();

    const page = await propertyIncomeEntriesDb.listPaginatedByProperty("prop-1", {}, { limit: 10 });
    const expected = referenceSortDateDesc(
      buildMergedEntries(
        [mapPropertyReservationRow(stayRowA), mapPropertyReservationRow(stayRowB)],
        [mapPropertyIncomeLineRow(lineRowA), mapPropertyIncomeLineRow(lineRowB)],
        ""
      )
    );

    expect(page.entries.map(getEntryKey)).toEqual(expected.map(getEntryKey));
  });
});
