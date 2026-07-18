import type {
  ICreatePropertyUnitBody,
  IPropertyUnit,
  IPropertyUnitsListMeta,
  IUpdatePropertyUnitBody,
  TPropertyUnitsListFilters,
  TPropertyUnitsListSortBy,
  TPropertyUnitsListSortDir,
} from "@/packages/shared";
import { PropertyLongStayStatus, UnitOccupancyFilter, UnitRentalType } from "@/packages/shared";
import { decodeUnitKeysetCursor, encodeUnitKeysetCursor } from "@/pagination/keyset-cursor";
import { takePageWithNextCursor } from "@/pagination/limit-plus-one";
import { shouldIncludeListMeta } from "@/pagination/should-include-list-meta";

import { mapPropertyUnitRow } from "./mappers";
import { pool } from "./pool";

export interface IUnitDeleteBlockers {
  incomeLineCount: number;
  longStayCount: number;
  reservationCount: number;
}

interface IUnitsListPaginatedOptions {
  cursor?: string;
  includeDeleted?: boolean;
  limit: number;
  sortBy?: TPropertyUnitsListSortBy;
  sortDir?: TPropertyUnitsListSortDir;
}

const ACTIVE_LEASE_EXISTS = `EXISTS (
  SELECT 1 FROM property_long_stays pls
  WHERE pls.unit_id = property_units.id
    AND pls.status = '${PropertyLongStayStatus.ACTIVE}'::property_long_stay_status
)`;

function buildUnitListParts(
  propertyId: string,
  filters: TPropertyUnitsListFilters = {},
  includeDeleted = false
): { conditions: string[]; values: unknown[] } {
  const conditions = ["property_id = $1"];
  const values: unknown[] = [propertyId];
  let p = 2;

  if (!includeDeleted) {
    conditions.push("is_deleted = false");
  }

  if (filters.rentalType) {
    conditions.push(`rental_type = $${p++}::property_unit_rental_type`);
    values.push(filters.rentalType);
  }

  if (filters.from) {
    conditions.push(`DATE(created_at) >= $${p++}`);
    values.push(filters.from);
  }

  if (filters.to) {
    conditions.push(`DATE(created_at) <= $${p++}`);
    values.push(filters.to);
  }

  if (filters.occupancy === UnitOccupancyFilter.VACANT) {
    conditions.push(
      `rental_type = '${UnitRentalType.LONG_TERM}'::property_unit_rental_type AND NOT ${ACTIVE_LEASE_EXISTS}`
    );
  } else if (filters.occupancy === UnitOccupancyFilter.OCCUPIED) {
    conditions.push(
      `rental_type = '${UnitRentalType.LONG_TERM}'::property_unit_rental_type AND ${ACTIVE_LEASE_EXISTS}`
    );
  }

  const qTrim = filters.q?.trim();
  if (qTrim) {
    const pattern = `%${qTrim}%`;
    conditions.push(`(
      unit_number ILIKE $${p}
      OR EXISTS (
        SELECT 1 FROM property_long_stays pls
        WHERE pls.unit_id = property_units.id
          AND pls.status = '${PropertyLongStayStatus.ACTIVE}'::property_long_stay_status
          AND (
            pls.guest_name ILIKE $${p + 1}
            OR pls.tenant_email ILIKE $${p + 2}
            OR EXISTS (
              SELECT 1 FROM lease_tenant_memberships ltm
              WHERE ltm.lease_id = pls.id
                AND ltm.role = 'secondary'::tenant_membership_role
                AND ltm.status NOT IN (
                  'declined'::tenant_membership_status,
                  'revoked'::tenant_membership_status,
                  'ended'::tenant_membership_status,
                  'expired'::tenant_membership_status
                )
                AND (
                  ltm.display_name ILIKE $${p + 3}
                  OR ltm.invite_email ILIKE $${p + 4}
                )
            )
          )
      )
    )`);
    values.push(pattern, pattern, pattern, pattern, pattern);
  }

  return { conditions, values };
}

function getUnitsListSortClause(sortDir: TPropertyUnitsListSortDir): {
  cursorOperator: ">" | "<";
  orderByClause: string;
} {
  if (sortDir === "desc") {
    return {
      cursorOperator: "<",
      orderByClause: "rental_type DESC, unit_number DESC, id DESC",
    };
  }

  return {
    cursorOperator: ">",
    orderByClause: "rental_type ASC, unit_number ASC, id ASC",
  };
}

export const propertyUnitsDb = {
  async create(propertyId: string, input: ICreatePropertyUnitBody): Promise<IPropertyUnit> {
    const result = await pool.query(
      `INSERT INTO property_units (property_id, unit_number, rental_type, layout)
       VALUES ($1, $2, $3::property_unit_rental_type, $4)
       RETURNING *`,
      [
        propertyId,
        input.unitNumber.trim(),
        input.rentalType ?? UnitRentalType.SHORT_TERM,
        input.layout.trim(),
      ]
    );
    return mapPropertyUnitRow(result.rows[0] as Record<string, unknown>);
  },

  async findById(id: string): Promise<IPropertyUnit | null> {
    const result = await pool.query(`SELECT * FROM property_units WHERE id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return mapPropertyUnitRow(result.rows[0] as Record<string, unknown>);
  },

  async findByProperty(propertyId: string, includeDeleted = false): Promise<IPropertyUnit[]> {
    const conditions = ["property_id = $1"];
    if (!includeDeleted) {
      conditions.push("is_deleted = false");
    }
    const result = await pool.query(
      `SELECT * FROM property_units
       WHERE ${conditions.join(" AND ")}
       ORDER BY unit_number ASC`,
      [propertyId]
    );
    return result.rows.map((row) => mapPropertyUnitRow(row as Record<string, unknown>));
  },

  async getListMetaByProperty(
    propertyId: string,
    filters: TPropertyUnitsListFilters = {},
    includeDeleted = false
  ): Promise<IPropertyUnitsListMeta> {
    const { conditions, values } = buildUnitListParts(propertyId, filters, includeDeleted);

    const result = await pool.query<{
      long_term_count: number;
      short_term_count: number;
      total_count: number;
    }>(
      `SELECT
         COUNT(*)::int AS total_count,
         COUNT(*) FILTER (WHERE rental_type = 'short_term')::int AS short_term_count,
         COUNT(*) FILTER (WHERE rental_type = 'long_term')::int AS long_term_count
       FROM property_units
       WHERE ${conditions.join(" AND ")}`,
      values
    );

    const row = result.rows[0];
    return {
      longTermCount: row?.long_term_count ?? 0,
      shortTermCount: row?.short_term_count ?? 0,
      totalCount: row?.total_count ?? 0,
    };
  },

  async getUnitDeleteBlockers(unitId: string): Promise<IUnitDeleteBlockers> {
    const result = await pool.query<{
      income_line_count: number;
      long_stay_count: number;
      reservation_count: number;
    }>(
      `SELECT
         (SELECT COUNT(*)::int FROM property_reservations WHERE unit_id = $1 AND is_deleted = false) AS reservation_count,
         (SELECT COUNT(*)::int FROM property_income_lines WHERE unit_id = $1 AND is_deleted = false) AS income_line_count,
         (SELECT COUNT(*)::int FROM property_long_stays WHERE unit_id = $1 AND status = 'active') AS long_stay_count`,
      [unitId]
    );
    const row = result.rows[0];
    return {
      incomeLineCount: row?.income_line_count ?? 0,
      longStayCount: row?.long_stay_count ?? 0,
      reservationCount: row?.reservation_count ?? 0,
    };
  },

  async listPaginatedByProperty(
    propertyId: string,
    filters: TPropertyUnitsListFilters,
    options: IUnitsListPaginatedOptions
  ): Promise<{
    meta?: IPropertyUnitsListMeta;
    nextCursor: string | null;
    units: IPropertyUnit[];
  }> {
    const includeDeleted = options.includeDeleted ?? false;
    const includeMeta = shouldIncludeListMeta(options.cursor);
    const listPromise = propertyUnitsDb.listPaginatedPage(propertyId, filters, options);
    const metaPromise = includeMeta
      ? propertyUnitsDb.getListMetaByProperty(propertyId, filters, includeDeleted)
      : Promise.resolve(undefined);

    const [{ nextCursor, units }, meta] = await Promise.all([listPromise, metaPromise]);

    return meta == null ? { nextCursor, units } : { meta, nextCursor, units };
  },

  async listPaginatedPage(
    propertyId: string,
    filters: TPropertyUnitsListFilters,
    options: IUnitsListPaginatedOptions
  ): Promise<{ nextCursor: string | null; units: IPropertyUnit[] }> {
    const includeDeleted = options.includeDeleted ?? false;
    const sortDir = options.sortDir ?? filters.sortDir ?? "asc";
    const { cursorOperator, orderByClause } = getUnitsListSortClause(sortDir);
    const { conditions, values } = buildUnitListParts(propertyId, filters, includeDeleted);
    let p = values.length + 1;

    if (options.cursor != null && options.cursor !== "") {
      const decoded = decodeUnitKeysetCursor(options.cursor);
      conditions.push(
        `(rental_type, unit_number, id) ${cursorOperator} ($${p++}::property_unit_rental_type, $${p++}, $${p++}::uuid)`
      );
      values.push(decoded.rentalType, decoded.unitNumber, decoded.id);
    }

    const limitParam = p;
    values.push(options.limit + 1);

    const result = await pool.query(
      `SELECT * FROM property_units
       WHERE ${conditions.join(" AND ")}
       ORDER BY ${orderByClause}
       LIMIT $${limitParam}`,
      values
    );

    const rows = result.rows as Record<string, unknown>[];
    const { nextCursor, page: pageRows } = takePageWithNextCursor(rows, options.limit, (last) =>
      encodeUnitKeysetCursor(
        last.rental_type as string,
        last.unit_number as string,
        last.id as string
      )
    );

    return {
      nextCursor,
      units: pageRows.map((row) => mapPropertyUnitRow(row)),
    };
  },

  async restore(id: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE property_units SET is_deleted = false, deleted_at = NULL WHERE id = $1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  },

  async softDelete(id: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE property_units SET is_deleted = true, deleted_at = NOW() WHERE id = $1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  },

  async update(id: string, input: IUpdatePropertyUnitBody): Promise<IPropertyUnit | null> {
    const existing = await propertyUnitsDb.findById(id);
    if (existing == null) return null;

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (input.unitNumber !== undefined) {
      setClauses.push(`unit_number = $${p++}`);
      values.push(input.unitNumber.trim());
    }
    if (input.rentalType !== undefined) {
      setClauses.push(`rental_type = $${p++}::property_unit_rental_type`);
      values.push(input.rentalType);
    }
    if (input.layout !== undefined) {
      setClauses.push(`layout = $${p++}`);
      values.push(input.layout.trim());
    }

    if (setClauses.length === 0) return existing;

    values.push(id);
    const result = await pool.query(
      `UPDATE property_units SET ${setClauses.join(", ")} WHERE id = $${p} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return null;
    return mapPropertyUnitRow(result.rows[0] as Record<string, unknown>);
  },
};
