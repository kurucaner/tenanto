import type {
  IPropertyIncomeEntriesListMeta,
  IPropertyIncomeEntriesListQuery,
  IPropertyIncomeLinesListQuery,
  IPropertyReservationsListQuery,
  TPropertyIncomeEntry,
} from "@/packages/shared";
import { IncomeEntryKind } from "@/packages/shared";
import {
  decodeIncomeEntryKeysetCursor,
  encodeIncomeEntryKeysetCursor,
} from "@/pagination/keyset-cursor";
import { takePageWithNextCursor } from "@/pagination/limit-plus-one";
import { shouldIncludeListMeta } from "@/pagination/should-include-list-meta";

import {
  buildIncomeEntryCursorPredicate,
  buildIncomeEntryOrderByClause,
  getLineSortKeySelects,
  getLongTermSortKeySelects,
  getStaySortKeySelects,
  type IIncomeEntryListSortOptions,
  needsUnitJoinForSort,
  resolveIncomeEntryListSort,
} from "./income-entry-list-sort";
import { mapPropertyIncomeLineRow, mapPropertyReservationRow } from "./mappers";
import { pool } from "./pool";
import { buildIncomeLineListParts } from "./property-income-lines";
import { buildReservationListParts } from "./property-reservations";
import { offsetSqlPlaceholders } from "./sql-placeholders";

const RESERVATION_CHANNEL_JOIN = `
  INNER JOIN property_channel_commissions pcc ON pcc.id = pr.channel_commission_id
`;

const STAY_BRANCH_SELECT = `
  pr.*,
  pcc.name AS channel_name,
  pcc.exclude_cleaning_from_commission_base,
  pcc.exclude_resort_tax_from_payout
`;

type TIncomeEntriesListDbFilters = Omit<IPropertyIncomeEntriesListQuery, "cursor" | "limit">;

interface IIncomeEntryBranchPlan {
  includeLines: boolean;
  includeLongTerm: boolean;
  includeStays: boolean;
  lineTypeId?: string;
}

function resolveIncomeTypeFilter(incomeType?: string): IIncomeEntryBranchPlan {
  if (!incomeType || incomeType === "") {
    return { includeLines: true, includeLongTerm: true, includeStays: true };
  }
  if (incomeType === IncomeEntryKind.STAY) {
    return { includeLines: false, includeLongTerm: false, includeStays: true };
  }
  if (incomeType === IncomeEntryKind.LONG_TERM) {
    return { includeLines: false, includeLongTerm: true, includeStays: false };
  }
  return {
    includeLines: true,
    includeLongTerm: false,
    includeStays: false,
    lineTypeId: incomeType,
  };
}

function toStayListFilters(filters: TIncomeEntriesListDbFilters): IPropertyReservationsListQuery {
  return {
    channelCommissionId: filters.channelCommissionId,
    from: filters.from,
    q: filters.q,
    refundStatus: filters.refundStatus,
    status: filters.status,
    to: filters.to,
    unitId: filters.unitId,
  };
}

function toLineListFilters(
  filters: TIncomeEntriesListDbFilters,
  lineTypeId?: string
): IPropertyIncomeLinesListQuery {
  const next: IPropertyIncomeLinesListQuery = {
    from: filters.from,
    q: filters.q,
    refundStatus: filters.refundStatus,
    to: filters.to,
    unitId: filters.unitId,
  };
  if (lineTypeId) {
    next.incomeLineTypeId = lineTypeId;
  }
  return next;
}

function formatSortKeyDate(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  return null;
}

function formatSortKeyNum(value: unknown): number | null {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatSortKeyText(value: unknown): string | null {
  if (value == null) return null;
  return String(value);
}

function mapUnifiedRow(row: Record<string, unknown>): TPropertyIncomeEntry {
  const entryKind = row.entry_kind as string;
  const payload = row.row_payload as Record<string, unknown>;
  if (entryKind === IncomeEntryKind.STAY) {
    return { entryKind: IncomeEntryKind.STAY, stay: mapPropertyReservationRow(payload) };
  }
  if (entryKind === IncomeEntryKind.LONG_TERM) {
    return { entryKind: IncomeEntryKind.LONG_TERM, line: mapPropertyIncomeLineRow(payload) };
  }
  return { entryKind: IncomeEntryKind.LINE, line: mapPropertyIncomeLineRow(payload) };
}

function buildStayBranchSql(
  propertyId: string,
  filters: TIncomeEntriesListDbFilters,
  includeDeleted: boolean,
  sort: IIncomeEntryListSortOptions
): { sql: string; values: unknown[] } {
  const { conditions, joinUnits, values } = buildReservationListParts(
    propertyId,
    toStayListFilters(filters),
    includeDeleted
  );
  const { sortKeyDate, sortKeyNum, sortKeyText } = getStaySortKeySelects(sort.sortBy);
  const unitJoin = needsUnitJoinForSort(sort.sortBy)
    ? "LEFT JOIN property_units pu ON pu.id = pr.unit_id"
    : "";

  return {
    sql: `
      SELECT
        '${IncomeEntryKind.STAY}'::text AS entry_kind,
        inner_row.sort_key_date,
        inner_row.sort_key_num,
        inner_row.sort_key_text,
        inner_row.created_at,
        inner_row.id,
        row_to_json(inner_row) AS row_payload
      FROM (
        SELECT
          ${STAY_BRANCH_SELECT},
          (${sortKeyDate}) AS sort_key_date,
          (${sortKeyNum}) AS sort_key_num,
          (${sortKeyText}) AS sort_key_text
        FROM property_reservations pr
        ${RESERVATION_CHANNEL_JOIN}
        ${unitJoin}
        ${joinUnits}
        WHERE ${conditions.join(" AND ")}
      ) inner_row`,
    values,
  };
}

function buildIncomeLineEntryBranchSql(
  propertyId: string,
  filters: TIncomeEntriesListDbFilters,
  includeDeleted: boolean,
  entryKind: typeof IncomeEntryKind.LINE | typeof IncomeEntryKind.LONG_TERM,
  lineTypeId: string | undefined,
  longStayIdConstraint: "is_null" | "is_not_null",
  sort: IIncomeEntryListSortOptions
): { sql: string; values: unknown[] } {
  const { conditions, joinUnits, values } = buildIncomeLineListParts(
    propertyId,
    toLineListFilters(filters, lineTypeId),
    includeDeleted
  );
  const longStayCondition =
    longStayIdConstraint === "is_null"
      ? "pil.long_stay_id IS NULL"
      : "pil.long_stay_id IS NOT NULL";
  const branchConditions = [...conditions, longStayCondition];
  const { sortKeyDate, sortKeyNum, sortKeyText } =
    entryKind === IncomeEntryKind.LONG_TERM
      ? getLongTermSortKeySelects(sort.sortBy)
      : getLineSortKeySelects(sort.sortBy);
  const unitJoin = needsUnitJoinForSort(sort.sortBy)
    ? "LEFT JOIN property_units pu ON pu.id = pil.unit_id"
    : "";

  return {
    sql: `
      SELECT
        '${entryKind}'::text AS entry_kind,
        inner_row.sort_key_date,
        inner_row.sort_key_num,
        inner_row.sort_key_text,
        inner_row.created_at,
        inner_row.id,
        row_to_json(inner_row) AS row_payload
      FROM (
        SELECT
          pil.*,
          ilt.name AS income_line_type_name,
          (${sortKeyDate}) AS sort_key_date,
          (${sortKeyNum}) AS sort_key_num,
          (${sortKeyText}) AS sort_key_text
        FROM property_income_lines pil
        INNER JOIN property_income_line_types ilt ON ilt.id = pil.income_line_type_id
        ${unitJoin}
        ${joinUnits}
        WHERE ${branchConditions.join(" AND ")}
      ) inner_row`,
    values,
  };
}

function buildLineBranchSql(
  propertyId: string,
  filters: TIncomeEntriesListDbFilters,
  includeDeleted: boolean,
  lineTypeId: string | undefined,
  sort: IIncomeEntryListSortOptions
): { sql: string; values: unknown[] } {
  return buildIncomeLineEntryBranchSql(
    propertyId,
    filters,
    includeDeleted,
    IncomeEntryKind.LINE,
    lineTypeId,
    "is_null",
    sort
  );
}

function buildLongTermBranchSql(
  propertyId: string,
  filters: TIncomeEntriesListDbFilters,
  includeDeleted: boolean,
  sort: IIncomeEntryListSortOptions
): { sql: string; values: unknown[] } {
  return buildIncomeLineEntryBranchSql(
    propertyId,
    filters,
    includeDeleted,
    IncomeEntryKind.LONG_TERM,
    undefined,
    "is_not_null",
    sort
  );
}

function buildMergedUnionSql(
  propertyId: string,
  filters: TIncomeEntriesListDbFilters,
  includeDeleted: boolean,
  sort: IIncomeEntryListSortOptions
): { sql: string; values: unknown[] } {
  const branchPlan = resolveIncomeTypeFilter(filters.incomeType);
  const branches: string[] = [];
  const values: unknown[] = [];

  if (branchPlan.includeStays) {
    const stayBranch = buildStayBranchSql(propertyId, filters, includeDeleted, sort);
    branches.push(stayBranch.sql);
    values.push(...stayBranch.values);
  }

  if (branchPlan.includeLongTerm) {
    const longTermBranch = buildLongTermBranchSql(propertyId, filters, includeDeleted, sort);
    branches.push(offsetSqlPlaceholders(longTermBranch.sql, values.length));
    values.push(...longTermBranch.values);
  }

  if (branchPlan.includeLines) {
    const lineBranch = buildLineBranchSql(
      propertyId,
      filters,
      includeDeleted,
      branchPlan.lineTypeId,
      sort
    );
    branches.push(offsetSqlPlaceholders(lineBranch.sql, values.length));
    values.push(...lineBranch.values);
  }

  if (branches.length === 0) {
    return {
      sql: `
        SELECT
          ''::text AS entry_kind,
          NULL::date AS sort_key_date,
          NULL::numeric AS sort_key_num,
          NULL::text AS sort_key_text,
          NOW() AS created_at,
          '00000000-0000-4000-8000-000000000000'::uuid AS id,
          NULL::json AS row_payload
        WHERE 1 = 0`,
      values: [],
    };
  }

  return {
    sql: branches.join("\nUNION ALL\n"),
    values,
  };
}

function buildPaginatedListSql(
  propertyId: string,
  filters: TIncomeEntriesListDbFilters,
  options: { cursor?: string; includeDeleted?: boolean; limit: number }
): { sort: IIncomeEntryListSortOptions; sql: string; values: unknown[] } {
  const includeDeleted = options.includeDeleted ?? false;
  const sort = resolveIncomeEntryListSort(filters.sortBy, filters.sortDir);
  const { sql: unionSql, values } = buildMergedUnionSql(propertyId, filters, includeDeleted, sort);
  const conditions: string[] = [];
  let p = values.length + 1;

  if (options.cursor != null && options.cursor !== "") {
    const decoded = decodeIncomeEntryKeysetCursor(options.cursor);
    if (decoded.sortBy !== sort.sortBy || decoded.sortDir !== sort.sortDir) {
      throw new Error("Invalid cursor");
    }

    const { nextParamIndex, predicate } = buildIncomeEntryCursorPredicate(sort, p);
    conditions.push(predicate);

    if (sort.sortKeyKind === "date") {
      values.push(decoded.sortKeyDate, decoded.createdAt, decoded.id, decoded.entryKind);
    } else if (sort.sortKeyKind === "num") {
      values.push(decoded.sortKeyNum, decoded.createdAt, decoded.id, decoded.entryKind);
    } else {
      values.push(decoded.sortKeyText, decoded.createdAt, decoded.id, decoded.entryKind);
    }

    p = nextParamIndex;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limitParam = p;
  values.push(options.limit + 1);

  const sql = `
    SELECT
      merged.entry_kind,
      merged.sort_key_date,
      merged.sort_key_num,
      merged.sort_key_text,
      merged.created_at,
      merged.id,
      merged.row_payload
    FROM (
      ${unionSql}
    ) merged
    ${whereClause}
    ${buildIncomeEntryOrderByClause(sort)}
    LIMIT $${limitParam}`;

  return { sort, sql, values };
}

export const propertyIncomeEntriesDb = {
  async getListMetaByProperty(
    propertyId: string,
    filters: TIncomeEntriesListDbFilters,
    includeDeleted = false
  ): Promise<IPropertyIncomeEntriesListMeta> {
    const branchPlan = resolveIncomeTypeFilter(filters.incomeType);
    const counts: Promise<number>[] = [];

    if (branchPlan.includeStays) {
      const { conditions, joinUnits, values } = buildReservationListParts(
        propertyId,
        toStayListFilters(filters),
        includeDeleted
      );
      counts.push(
        pool
          .query<{ total_count: number }>(
            `SELECT COUNT(*)::int AS total_count
             FROM property_reservations pr
             ${RESERVATION_CHANNEL_JOIN}
             ${joinUnits}
             WHERE ${conditions.join(" AND ")}`,
            values
          )
          .then((result) => result.rows[0]?.total_count ?? 0)
      );
    }

    if (branchPlan.includeLongTerm) {
      const { conditions, joinLineTypes, joinUnits, values } = buildIncomeLineListParts(
        propertyId,
        toLineListFilters(filters),
        includeDeleted
      );
      const longTermConditions = [...conditions, "pil.long_stay_id IS NOT NULL"];
      counts.push(
        pool
          .query<{ total_count: number }>(
            `SELECT COUNT(*)::int AS total_count
             FROM property_income_lines pil
             ${joinLineTypes}
             ${joinUnits}
             WHERE ${longTermConditions.join(" AND ")}`,
            values
          )
          .then((result) => result.rows[0]?.total_count ?? 0)
      );
    }

    if (branchPlan.includeLines) {
      const { conditions, joinLineTypes, joinUnits, values } = buildIncomeLineListParts(
        propertyId,
        toLineListFilters(filters, branchPlan.lineTypeId),
        includeDeleted
      );
      const lineConditions = [...conditions, "pil.long_stay_id IS NULL"];
      counts.push(
        pool
          .query<{ total_count: number }>(
            `SELECT COUNT(*)::int AS total_count
             FROM property_income_lines pil
             ${joinLineTypes}
             ${joinUnits}
             WHERE ${lineConditions.join(" AND ")}`,
            values
          )
          .then((result) => result.rows[0]?.total_count ?? 0)
      );
    }

    const totalCount = (await Promise.all(counts)).reduce((sum, count) => sum + count, 0);
    return { totalCount };
  },

  async listPaginatedByProperty(
    propertyId: string,
    filters: TIncomeEntriesListDbFilters,
    options: { cursor?: string; includeDeleted?: boolean; limit: number }
  ): Promise<{
    entries: TPropertyIncomeEntry[];
    meta?: IPropertyIncomeEntriesListMeta;
    nextCursor: string | null;
  }> {
    const includeDeleted = options.includeDeleted ?? false;
    const includeMeta = shouldIncludeListMeta(options.cursor);
    const listPromise = propertyIncomeEntriesDb.listPaginatedPage(propertyId, filters, options);
    const metaPromise = includeMeta
      ? propertyIncomeEntriesDb.getListMetaByProperty(propertyId, filters, includeDeleted)
      : Promise.resolve(undefined);

    const [{ entries, nextCursor }, meta] = await Promise.all([listPromise, metaPromise]);

    return meta == null ? { entries, nextCursor } : { entries, meta, nextCursor };
  },

  async listPaginatedPage(
    propertyId: string,
    filters: TIncomeEntriesListDbFilters,
    options: { cursor?: string; includeDeleted?: boolean; limit: number }
  ): Promise<{ entries: TPropertyIncomeEntry[]; nextCursor: string | null }> {
    const { sort, sql, values } = buildPaginatedListSql(propertyId, filters, options);
    const result = await pool.query(sql, values);
    const rows = result.rows as Record<string, unknown>[];

    const { nextCursor, page: pageRows } = takePageWithNextCursor(rows, options.limit, (last) =>
      encodeIncomeEntryKeysetCursor({
        createdAt: last.created_at as Date | string,
        entryKind: last.entry_kind as string,
        id: last.id as string,
        sortBy: sort.sortBy,
        sortDir: sort.sortDir,
        sortKeyDate: formatSortKeyDate(last.sort_key_date),
        sortKeyNum: formatSortKeyNum(last.sort_key_num),
        sortKeyText: formatSortKeyText(last.sort_key_text),
      })
    );

    return {
      entries: pageRows.map((row) => mapUnifiedRow(row)),
      nextCursor,
    };
  },
};
