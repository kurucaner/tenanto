import { describe, expect, mock, test } from "bun:test";

import {
  IncomeEntryKind,
  type IPropertyIncomeLine,
  type IPropertyReservation,
  isDepositIncomeLine,
  type TPropertyIncomeEntry,
} from "@/packages/shared";
import {
  INCOME_ENTRIES_LINE_TYPE_ID,
  incomeEntriesLineRowA,
  incomeEntriesLineRowB,
  incomeEntriesLongTermRowA,
  incomeEntriesMergedRowsCanonical,
  incomeEntriesStayRowA,
  incomeEntriesStayRowB,
} from "@/test-fixtures/pagination/income-entries-pagination-rows";

function rowIsBeforeDateCursor(
  row: (typeof incomeEntriesMergedRowsCanonical)[number],
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
    if (sql.includes("property_reservations")) {
      return Promise.resolve({
        rows: [{ total_count: 2 }],
      });
    }
    if (sql.includes("long_stay_id IS NOT NULL")) {
      return Promise.resolve({
        rows: [{ total_count: 1 }],
      });
    }
    if (sql.includes("long_stay_id IS NULL")) {
      return Promise.resolve({
        rows: [{ total_count: 2 }],
      });
    }
    return Promise.resolve({
      rows: [{ total_count: 0 }],
    });
  }

  let rows = [...incomeEntriesMergedRowsCanonical];

  if (sql.includes("entry_kind) <") && values) {
    const entryKind = values[values.length - 2] as string;
    const id = values[values.length - 3] as string;
    const createdAt = values[values.length - 4] as string;
    const sortKey = values[values.length - 5] as string;
    rows = rows.filter((row) => rowIsBeforeDateCursor(row, sortKey, createdAt, id, entryKind));
  }

  const limitPlusOne =
    (values?.[values.length - 1] as number | undefined) ?? incomeEntriesMergedRowsCanonical.length;

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
  const showLongTerm = incomeTypeFilter === "" || incomeTypeFilter === IncomeEntryKind.LONG_TERM;
  const showDepositOnly = incomeTypeFilter === IncomeEntryKind.DEPOSIT;
  const showCatalogLines =
    incomeTypeFilter !== "" &&
    incomeTypeFilter !== IncomeEntryKind.STAY &&
    incomeTypeFilter !== IncomeEntryKind.LONG_TERM &&
    incomeTypeFilter !== IncomeEntryKind.DEPOSIT;
  const showLines = incomeTypeFilter === "" || showDepositOnly || showCatalogLines;

  if (showStays) {
    for (const stay of reservations) {
      entries.push({ entryKind: IncomeEntryKind.STAY, stay });
    }
  }

  if (showLongTerm) {
    for (const line of incomeLines) {
      if (line.longStayId != null && !isDepositIncomeLine(line)) {
        entries.push({ entryKind: IncomeEntryKind.LONG_TERM, line });
      }
    }
  }

  if (showLines) {
    for (const line of incomeLines) {
      if (line.longStayId == null || isDepositIncomeLine(line)) {
        if (incomeTypeFilter === "") {
          entries.push({ entryKind: IncomeEntryKind.LINE, line });
        } else if (showDepositOnly && isDepositIncomeLine(line)) {
          entries.push({ entryKind: IncomeEntryKind.LINE, line });
        } else if (showCatalogLines && line.incomeLineTypeId === incomeTypeFilter) {
          entries.push({ entryKind: IncomeEntryKind.LINE, line });
        }
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
  if (entry.entryKind === IncomeEntryKind.STAY) {
    return `stay:${entry.stay.id}`;
  }
  if (entry.entryKind === IncomeEntryKind.LONG_TERM) {
    return `longTerm:${entry.line.id}`;
  }
  return `line:${entry.line.id}`;
}

describe("propertyIncomeEntriesDb.listPaginatedByProperty", () => {
  test("returns a merged page and nextCursor when more rows exist", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyIncomeEntriesDb.listPaginatedByProperty(
      "prop-1",
      {},
      { limit: 2 }
    );

    expect(firstPage.entries).toHaveLength(2);
    expect(firstPage.entries[0]?.entryKind).toBe(IncomeEntryKind.STAY);
    expect(
      firstPage.entries[0]?.entryKind === IncomeEntryKind.STAY
        ? firstPage.entries[0].stay.checkIn
        : null
    ).toBe("2026-07-10");
    expect(firstPage.nextCursor).toBeString();
    expect(firstPage.meta).toEqual({ totalCount: 5 });
    expect(mockQuery.mock.calls).toHaveLength(4);

    const sql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    expect(sql).toContain("UNION ALL");
    expect(sql).toContain("ORDER BY merged.sort_key_date DESC");
    expect(sql).toContain("LIMIT $");
    expect(sql).toContain("pil.property_id = $2");
    expect(sql).not.toMatch(/property_income_lines[\s\S]*pil\.property_id = \$1/);
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

    const firstPage = await propertyIncomeEntriesDb.listPaginatedByProperty(
      "prop-1",
      {},
      { limit: 2 }
    );
    expect(firstPage.nextCursor).toBeString();

    mockQuery.mockClear();
    await propertyIncomeEntriesDb.listPaginatedByProperty(
      "prop-1",
      {},
      { cursor: firstPage.nextCursor!, limit: 2 }
    );

    const sql = mockQuery.mock.calls[0]?.[0] as string;
    expect(sql).toContain(
      "merged.sort_key_date, merged.created_at, merged.id, merged.entry_kind) <"
    );
    expect(mockQuery.mock.calls).toHaveLength(1);
  });

  test("omits meta on cursor pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyIncomeEntriesDb.listPaginatedByProperty(
      "prop-1",
      {},
      { limit: 2 }
    );
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
      { incomeType: INCOME_ENTRIES_LINE_TYPE_ID },
      { limit: 2 }
    );

    const sql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    expect(sql).toContain("property_income_lines pil");
    expect(sql).not.toContain("property_reservations pr");
    expect(sql).toContain("pil.income_line_type_id = $");
    expect(sql).toContain(
      "pil.long_stay_id IS NULL OR lower(ilt.name) = lower('Security deposit')"
    );
  });

  test("applies longTerm incomeType filter in SQL", async () => {
    mockQuery.mockClear();

    await propertyIncomeEntriesDb.listPaginatedByProperty(
      "prop-1",
      { incomeType: IncomeEntryKind.LONG_TERM },
      { limit: 2 }
    );

    const sql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    expect(sql).toContain("property_income_lines pil");
    expect(sql).not.toContain("property_reservations pr");
    expect(sql).toContain("pil.long_stay_id IS NOT NULL");
    expect(sql).toContain("lower(ilt.name) = lower('Security deposit')");
    expect(sql).toContain(`'${IncomeEntryKind.LONG_TERM}'::text AS entry_kind`);
  });

  test("applies deposit incomeType filter in SQL", async () => {
    mockQuery.mockClear();

    await propertyIncomeEntriesDb.listPaginatedByProperty(
      "prop-1",
      { incomeType: IncomeEntryKind.DEPOSIT },
      { limit: 2 }
    );

    const sql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    expect(sql).toContain("property_income_lines pil");
    expect(sql).not.toContain("property_reservations pr");
    expect(sql).toContain("lower(ilt.name) = lower('Security deposit')");
    expect(sql).not.toContain("pil.long_stay_id IS NULL OR");
    expect(sql).toContain(`'${IncomeEntryKind.LINE}'::text AS entry_kind`);
  });

  test("longTerm SQL excludes Security deposit; line SQL includes deposit with longStayId", async () => {
    mockQuery.mockClear();

    await propertyIncomeEntriesDb.listPaginatedByProperty("prop-1", {}, { limit: 10 });

    const sql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    expect(sql).toContain(
      "pil.long_stay_id IS NOT NULL AND NOT (lower(ilt.name) = lower('Security deposit'))"
    );
    expect(sql).toContain(
      "(pil.long_stay_id IS NULL OR lower(ilt.name) = lower('Security deposit'))"
    );
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

    expect(collected).toHaveLength(5);
    expect(new Set(collected.map(getEntryKey)).size).toBe(5);
  });

  test("matches merged client ordering for date desc", async () => {
    mockQuery.mockClear();

    const page = await propertyIncomeEntriesDb.listPaginatedByProperty("prop-1", {}, { limit: 10 });
    const expected = referenceSortDateDesc(
      buildMergedEntries(
        [
          mapPropertyReservationRow(incomeEntriesStayRowA),
          mapPropertyReservationRow(incomeEntriesStayRowB),
        ],
        [
          mapPropertyIncomeLineRow(incomeEntriesLineRowA),
          mapPropertyIncomeLineRow(incomeEntriesLineRowB),
          mapPropertyIncomeLineRow(incomeEntriesLongTermRowA),
        ],
        ""
      )
    );

    expect(page.entries.map(getEntryKey)).toEqual(expected.map(getEntryKey));
  });

  test("applies search filter across stay and line branches", async () => {
    mockQuery.mockClear();

    await propertyIncomeEntriesDb.listPaginatedByProperty("prop-1", { q: "alex" }, { limit: 10 });

    const listSql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    expect(listSql).toContain("pr.guest_name ILIKE");
    expect(listSql).toContain("ilt.name ILIKE");

    const countSqls = mockQuery.mock.calls
      .filter(([query]) => (query as string).includes("COUNT(*)"))
      .map(([query]) => query as string);
    expect(countSqls.some((sql) => sql.includes("property_income_line_types ilt"))).toBe(true);
    expect(countSqls.some((sql) => sql.includes("ilt.name ILIKE"))).toBe(true);
    expect(countSqls.some((sql) => sql.includes("long_stay_id IS NOT NULL"))).toBe(true);
    expect(countSqls.some((sql) => sql.includes("long_stay_id IS NULL"))).toBe(true);
  });

  test("applies refundStatus filter across stay and line branches", async () => {
    mockQuery.mockClear();

    await propertyIncomeEntriesDb.listPaginatedByProperty(
      "prop-1",
      { refundStatus: "refunded" },
      { limit: 10 }
    );

    const listSql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    expect(listSql).toContain("pr.refunded_at IS NOT NULL");
    expect(listSql).toContain("pil.refunded_at IS NOT NULL");

    const countSqls = mockQuery.mock.calls
      .filter(([query]) => (query as string).includes("COUNT(*)"))
      .map(([query]) => query as string);
    expect(countSqls.some((sql) => sql.includes("pr.refunded_at IS NOT NULL"))).toBe(true);
    expect(countSqls.some((sql) => sql.includes("pil.refunded_at IS NOT NULL"))).toBe(true);
    expect(countSqls.some((sql) => sql.includes("long_stay_id IS NOT NULL"))).toBe(true);
    expect(countSqls.some((sql) => sql.includes("long_stay_id IS NULL"))).toBe(true);
  });
});
