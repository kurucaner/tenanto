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

import { mapPropertyIncomeLineRow, mapPropertyReservationRow } from "./mappers";
import { pool } from "./pool";
import { buildIncomeLineListParts } from "./property-income-lines";
import { buildReservationListParts } from "./property-reservations";

const RESERVATION_CHANNEL_JOIN = `
  INNER JOIN property_channel_commissions pcc ON pcc.id = pr.channel_commission_id
`;

const STAY_BRANCH_SELECT = `
  pr.*,
  pcc.name AS channel_name,
  pcc.exclude_cleaning_from_commission_base,
  pcc.exclude_resort_tax_from_payout
`;

type TIncomeEntriesListDbFilters = Omit<
  IPropertyIncomeEntriesListQuery,
  "cursor" | "limit" | "sortBy" | "sortDir"
>;

interface IIncomeEntryBranchPlan {
  includeLines: boolean;
  includeStays: boolean;
  lineTypeId?: string;
}

function resolveIncomeTypeFilter(incomeType?: string): IIncomeEntryBranchPlan {
  if (!incomeType || incomeType === "") {
    return { includeLines: true, includeStays: true };
  }
  if (incomeType === IncomeEntryKind.STAY) {
    return { includeLines: false, includeStays: true };
  }
  return { includeLines: true, includeStays: false, lineTypeId: incomeType };
}

function toStayListFilters(filters: TIncomeEntriesListDbFilters): IPropertyReservationsListQuery {
  return {
    channelCommissionId: filters.channelCommissionId,
    from: filters.from,
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
    to: filters.to,
    unitId: filters.unitId,
  };
  if (lineTypeId) {
    next.incomeLineTypeId = lineTypeId;
  }
  return next;
}

function formatSortDateForCursor(sortDate: unknown): string {
  if (sortDate instanceof Date) {
    return sortDate.toISOString().slice(0, 10);
  }
  if (typeof sortDate === "string") {
    return sortDate.slice(0, 10);
  }
  throw new TypeError("Invalid sort_date for cursor");
}

function mapUnifiedRow(row: Record<string, unknown>): TPropertyIncomeEntry {
  const entryKind = row.entry_kind as string;
  const payload = row.row_payload as Record<string, unknown>;
  if (entryKind === IncomeEntryKind.STAY) {
    return { entryKind: IncomeEntryKind.STAY, stay: mapPropertyReservationRow(payload) };
  }
  return { entryKind: IncomeEntryKind.LINE, line: mapPropertyIncomeLineRow(payload) };
}

function buildStayBranchSql(
  propertyId: string,
  filters: TIncomeEntriesListDbFilters,
  includeDeleted: boolean
): { sql: string; values: unknown[] } {
  const { conditions, joinUnits, values } = buildReservationListParts(
    propertyId,
    toStayListFilters(filters),
    includeDeleted
  );

  return {
    sql: `
      SELECT
        '${IncomeEntryKind.STAY}'::text AS entry_kind,
        stay_payload.check_in AS sort_date,
        stay_payload.created_at,
        stay_payload.id,
        row_to_json(stay_payload) AS row_payload
      FROM (
        SELECT ${STAY_BRANCH_SELECT}
        FROM property_reservations pr
        ${RESERVATION_CHANNEL_JOIN}
        ${joinUnits}
        WHERE ${conditions.join(" AND ")}
      ) stay_payload`,
    values,
  };
}

function buildLineBranchSql(
  propertyId: string,
  filters: TIncomeEntriesListDbFilters,
  includeDeleted: boolean,
  lineTypeId?: string
): { sql: string; values: unknown[] } {
  const { conditions, joinUnits, values } = buildIncomeLineListParts(
    propertyId,
    toLineListFilters(filters, lineTypeId),
    includeDeleted
  );

  return {
    sql: `
      SELECT
        '${IncomeEntryKind.LINE}'::text AS entry_kind,
        line_payload.transaction_date AS sort_date,
        line_payload.created_at,
        line_payload.id,
        row_to_json(line_payload) AS row_payload
      FROM (
        SELECT
          pil.*,
          ilt.name AS income_line_type_name
        FROM property_income_lines pil
        INNER JOIN property_income_line_types ilt ON ilt.id = pil.income_line_type_id
        ${joinUnits}
        WHERE ${conditions.join(" AND ")}
      ) line_payload`,
    values,
  };
}

function buildMergedUnionSql(
  propertyId: string,
  filters: TIncomeEntriesListDbFilters,
  includeDeleted: boolean
): { sql: string; values: unknown[] } {
  const branchPlan = resolveIncomeTypeFilter(filters.incomeType);
  const branches: string[] = [];
  const values: unknown[] = [];

  if (branchPlan.includeStays) {
    const stayBranch = buildStayBranchSql(propertyId, filters, includeDeleted);
    branches.push(stayBranch.sql);
    values.push(...stayBranch.values);
  }

  if (branchPlan.includeLines) {
    const lineBranch = buildLineBranchSql(
      propertyId,
      filters,
      includeDeleted,
      branchPlan.lineTypeId
    );
    branches.push(lineBranch.sql);
    values.push(...lineBranch.values);
  }

  if (branches.length === 0) {
    return {
      sql: `
        SELECT
          ''::text AS entry_kind,
          CURRENT_DATE AS sort_date,
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
): { sql: string; values: unknown[] } {
  const includeDeleted = options.includeDeleted ?? false;
  const { sql: unionSql, values } = buildMergedUnionSql(propertyId, filters, includeDeleted);
  const conditions: string[] = [];
  let p = values.length + 1;

  if (options.cursor != null && options.cursor !== "") {
    const decoded = decodeIncomeEntryKeysetCursor(options.cursor);
    conditions.push(
      `(merged.sort_date, merged.created_at, merged.id, merged.entry_kind) < ($${p++}::date, $${p++}::timestamptz, $${p++}::uuid, $${p++}::text)`
    );
    values.push(decoded.sortDate, decoded.createdAt, decoded.id, decoded.entryKind);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limitParam = p;
  values.push(options.limit + 1);

  const sql = `
    SELECT merged.entry_kind, merged.sort_date, merged.created_at, merged.id, merged.row_payload
    FROM (
      ${unionSql}
    ) merged
    ${whereClause}
    ORDER BY merged.sort_date DESC, merged.created_at DESC, merged.id DESC, merged.entry_kind DESC
    LIMIT $${limitParam}`;

  return { sql, values };
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

    if (branchPlan.includeLines) {
      const { conditions, joinUnits, values } = buildIncomeLineListParts(
        propertyId,
        toLineListFilters(filters, branchPlan.lineTypeId),
        includeDeleted
      );
      counts.push(
        pool
          .query<{ total_count: number }>(
            `SELECT COUNT(*)::int AS total_count
             FROM property_income_lines pil
             ${joinUnits}
             WHERE ${conditions.join(" AND ")}`,
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
    const { sql, values } = buildPaginatedListSql(propertyId, filters, options);
    const result = await pool.query(sql, values);
    const rows = result.rows as Record<string, unknown>[];

    const { nextCursor, page: pageRows } = takePageWithNextCursor(rows, options.limit, (last) =>
      encodeIncomeEntryKeysetCursor(
        formatSortDateForCursor(last.sort_date),
        last.created_at as Date | string,
        last.id as string,
        last.entry_kind as string
      )
    );

    return {
      entries: pageRows.map((row) => mapUnifiedRow(row)),
      nextCursor,
    };
  },
};
