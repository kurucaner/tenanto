import type {
  ICreatePropertyLongStayBody,
  IExtendPropertyLongStayBody,
  IPropertyLongStay,
  IPropertyLongStayRentMonth,
  IPropertyLongStayRentPeriod,
  IPropertyLongStaysListMeta,
  IUpdatePropertyLongStayBody,
  TPropertyLongStaysListFilters,
} from "@/packages/shared";
import {
  calculateExpectedRentForLeaseMonth,
  calculateLeaseEndDate,
  enumerateLeaseMonths,
  getCurrentLeaseRent,
  getLeaseScheduleEffectiveEndDate,
  isIncomeLinePaidForRentSchedule,
  PropertyLongStayStatus,
  transactionDateToMonth,
  validateExtendLease,
} from "@/packages/shared";
import { decodeLeaseKeysetCursor, encodeLeaseKeysetCursor } from "@/pagination/keyset-cursor";
import { takePageWithNextCursor } from "@/pagination/limit-plus-one";
import { shouldIncludeListMeta } from "@/pagination/should-include-list-meta";

import {
  mapPropertyIncomeLineRow,
  mapPropertyLongStayRentPeriodRow,
  mapPropertyLongStayRow,
} from "./mappers";
import { pool } from "./pool";

const LEASE_EFFECTIVE_END = "COALESCE(pls.actual_end_date, pls.lease_end_date)";

function buildPropertyLongStayListParts(
  propertyId: string,
  filters: TPropertyLongStaysListFilters
): { conditions: string[]; joinUnits: string; values: unknown[] } {
  const conditions = ["pls.property_id = $1"];
  const values: unknown[] = [propertyId];
  let p = 2;
  let joinUnits = "";

  if (filters.status) {
    conditions.push(`pls.status = $${p++}::property_long_stay_status`);
    values.push(filters.status);
  }
  if (filters.unitId) {
    conditions.push(`pls.unit_id = $${p++}`);
    values.push(filters.unitId);
  }
  if (filters.from) {
    conditions.push(`${LEASE_EFFECTIVE_END} >= $${p++}`);
    values.push(filters.from);
  }
  if (filters.to) {
    conditions.push(`pls.lease_start_date <= $${p++}`);
    values.push(filters.to);
  }

  const qTrim = filters.q?.trim();
  if (qTrim) {
    joinUnits = "LEFT JOIN property_units pu ON pu.id = pls.unit_id";
    const pattern = `%${qTrim}%`;
    conditions.push(`(
      pls.guest_name ILIKE $${p}
      OR pls.tenant_email ILIKE $${p + 1}
      OR pu.unit_number ILIKE $${p + 2}
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(pls.secondary_tenants) AS st
        WHERE st->>'name' ILIKE $${p + 3}
           OR COALESCE(st->>'email', '') ILIKE $${p + 4}
      )
    )`);
    values.push(pattern, pattern, pattern, pattern, pattern);
  }

  return { conditions, joinUnits, values };
}

function formatLeaseStartDateForCursor(leaseStartDate: unknown): string {
  if (leaseStartDate instanceof Date) {
    return leaseStartDate.toISOString().slice(0, 10);
  }
  if (typeof leaseStartDate === "string") {
    return leaseStartDate.slice(0, 10);
  }
  throw new TypeError("invalid lease_start_date");
}

export class ActiveLongStayConflictError extends Error {
  constructor() {
    super("Unit already has an active lease");
    this.name = "ActiveLongStayConflictError";
  }
}

export class LongStayNotFoundError extends Error {
  constructor() {
    super("Long stay not found");
    this.name = "LongStayNotFoundError";
  }
}

export class LongStayNotActiveError extends Error {
  constructor() {
    super("Long stay is not active");
    this.name = "LongStayNotActiveError";
  }
}

export class InvalidExtendLeaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidExtendLeaseError";
  }
}

function getTodayUtcIsoDate(): string {
  const date = new Date();
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export const propertyLongStaysDb = {
  async create(propertyId: string, input: ICreatePropertyLongStayBody): Promise<IPropertyLongStay> {
    const activeLease = await propertyLongStaysDb.findActiveByUnitId(input.unitId);
    if (activeLease) {
      throw new ActiveLongStayConflictError();
    }

    const leaseEndDate = calculateLeaseEndDate(input.leaseStartDate, input.termMonths);
    const tenantEmail = input.tenantEmail?.trim() || null;
    const tenantPhone = input.tenantPhone?.trim() || null;

    const result = await pool.query(
      `INSERT INTO property_long_stays
         (property_id, unit_id, guest_name, lease_start_date, term_months, monthly_rent,
          lease_end_date, tenant_email, tenant_phone, status, secondary_tenants)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::property_long_stay_status, '[]'::jsonb)
       RETURNING *`,
      [
        propertyId,
        input.unitId,
        input.guestName.trim(),
        input.leaseStartDate,
        input.termMonths,
        input.monthlyRent,
        leaseEndDate,
        tenantEmail,
        tenantPhone,
        PropertyLongStayStatus.ACTIVE,
      ]
    );
    return mapPropertyLongStayRow(result.rows[0] as Record<string, unknown>);
  },

  async endLease(id: string, actualEndDate: string): Promise<IPropertyLongStay> {
    const result = await pool.query(
      `UPDATE property_long_stays
       SET status = $2::property_long_stay_status,
           actual_end_date = $3
       WHERE id = $1
         AND status = $4::property_long_stay_status
       RETURNING *`,
      [id, PropertyLongStayStatus.ENDED, actualEndDate, PropertyLongStayStatus.ACTIVE]
    );
    if (result.rows.length === 0) {
      const existing = await propertyLongStaysDb.findById(id);
      if (!existing) {
        throw new LongStayNotFoundError();
      }
      throw new LongStayNotActiveError();
    }
    return mapPropertyLongStayRow(result.rows[0] as Record<string, unknown>);
  },

  async extendLease(id: string, body: IExtendPropertyLongStayBody): Promise<IPropertyLongStay> {
    const existing = await propertyLongStaysDb.findById(id);
    if (!existing) {
      throw new LongStayNotFoundError();
    }
    if (existing.status !== PropertyLongStayStatus.ACTIVE) {
      throw new LongStayNotActiveError();
    }

    const validationError = validateExtendLease(body, existing, getTodayUtcIsoDate());
    if (validationError) {
      throw new InvalidExtendLeaseError(validationError);
    }

    const newTermMonths = existing.termMonths + body.additionalTermMonths;
    const newLeaseEndDate = calculateLeaseEndDate(existing.leaseStartDate, newTermMonths);
    const hasRentChange =
      body.newMonthlyRent !== undefined && body.rentEffectiveFromMonth !== undefined;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (hasRentChange) {
        const existingPeriods = await client.query(
          `SELECT id FROM property_long_stay_rent_periods WHERE long_stay_id = $1 LIMIT 1`,
          [id]
        );

        if (existingPeriods.rows.length === 0) {
          await client.query(
            `INSERT INTO property_long_stay_rent_periods
               (long_stay_id, effective_from_month, monthly_rent)
             VALUES ($1, $2, $3)`,
            [id, transactionDateToMonth(existing.leaseStartDate), existing.monthlyRent]
          );
        }

        await client.query(
          `INSERT INTO property_long_stay_rent_periods
             (long_stay_id, effective_from_month, monthly_rent)
           VALUES ($1, $2, $3)`,
          [id, body.rentEffectiveFromMonth, body.newMonthlyRent]
        );
      }

      const rentPeriodsResult = await client.query(
        `SELECT effective_from_month, monthly_rent
         FROM property_long_stay_rent_periods
         WHERE long_stay_id = $1
         ORDER BY effective_from_month ASC`,
        [id]
      );
      const rentPeriods = rentPeriodsResult.rows.map((row) =>
        mapPropertyLongStayRentPeriodRow(row as Record<string, unknown>)
      );
      const currentMonthlyRent = getCurrentLeaseRent(
        existing.monthlyRent,
        rentPeriods,
        getTodayUtcIsoDate()
      );

      const result = await client.query(
        `UPDATE property_long_stays
         SET term_months = $2,
             lease_end_date = $3,
             monthly_rent = $4
         WHERE id = $1
           AND status = $5::property_long_stay_status
         RETURNING *`,
        [id, newTermMonths, newLeaseEndDate, currentMonthlyRent, PropertyLongStayStatus.ACTIVE]
      );

      if (result.rows.length === 0) {
        throw new LongStayNotActiveError();
      }

      await client.query("COMMIT");
      return mapPropertyLongStayRow(result.rows[0] as Record<string, unknown>);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async findActiveByUnitId(unitId: string): Promise<IPropertyLongStay | null> {
    const result = await pool.query(
      `SELECT * FROM property_long_stays
       WHERE unit_id = $1
         AND status = $2::property_long_stay_status
       LIMIT 1`,
      [unitId, PropertyLongStayStatus.ACTIVE]
    );
    if (result.rows.length === 0) return null;
    return mapPropertyLongStayRow(result.rows[0] as Record<string, unknown>);
  },

  async findById(id: string): Promise<IPropertyLongStay | null> {
    const result = await pool.query(`SELECT * FROM property_long_stays WHERE id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return mapPropertyLongStayRow(result.rows[0] as Record<string, unknown>);
  },

  async getListMetaByProperty(
    propertyId: string,
    filters: TPropertyLongStaysListFilters
  ): Promise<IPropertyLongStaysListMeta> {
    const { conditions, joinUnits, values } = buildPropertyLongStayListParts(propertyId, filters);

    const result = await pool.query<{
      active_count: number;
      ended_count: number;
      total_count: number;
    }>(
      `SELECT
         COUNT(*)::int AS total_count,
         COUNT(*) FILTER (WHERE pls.status = 'active')::int AS active_count,
         COUNT(*) FILTER (WHERE pls.status = 'ended')::int AS ended_count
       FROM property_long_stays pls
       ${joinUnits}
       WHERE ${conditions.join(" AND ")}`,
      values
    );

    const row = result.rows[0];
    return {
      activeCount: row?.active_count ?? 0,
      endedCount: row?.ended_count ?? 0,
      totalCount: row?.total_count ?? 0,
    };
  },

  async getRentSchedule(
    longStayId: string,
    referenceDate: string = getTodayUtcIsoDate()
  ): Promise<IPropertyLongStayRentMonth[]> {
    const longStay = await propertyLongStaysDb.findById(longStayId);
    if (!longStay) {
      throw new LongStayNotFoundError();
    }

    const rentPeriods = await propertyLongStaysDb.listRentPeriods(longStayId);
    const effectiveEndDate = getLeaseScheduleEffectiveEndDate(longStay, referenceDate);
    const months = enumerateLeaseMonths(longStay.leaseStartDate, effectiveEndDate);

    const incomeResult = await pool.query(
      `SELECT *
       FROM property_income_lines
       WHERE long_stay_id = $1
         AND is_deleted = false
       ORDER BY transaction_date ASC`,
      [longStayId]
    );

    const paidByMonth = new Map<string, string>();
    for (const row of incomeResult.rows) {
      const line = mapPropertyIncomeLineRow(row as Record<string, unknown>);
      if (!isIncomeLinePaidForRentSchedule(line)) {
        continue;
      }

      const month = transactionDateToMonth(line.transactionDate);
      if (!paidByMonth.has(month)) {
        paidByMonth.set(month, line.id);
      }
    }

    return months.map((month) => {
      const incomeLineId = paidByMonth.get(month);
      const proration = calculateExpectedRentForLeaseMonth({
        baseMonthlyRent: longStay.monthlyRent,
        effectiveEndDate,
        leaseStartDate: longStay.leaseStartDate,
        month,
        rentPeriods,
      });
      return {
        daysInMonth: proration.daysInMonth,
        expectedRent: proration.expectedRent,
        incomeLineId,
        isPaid: incomeLineId !== undefined,
        isProrated: proration.isProrated,
        month,
        occupiedDays: proration.occupiedDays,
      };
    });
  },

  async listByProperty(
    propertyId: string,
    filters: TPropertyLongStaysListFilters = {}
  ): Promise<IPropertyLongStay[]> {
    const { conditions, joinUnits, values } = buildPropertyLongStayListParts(propertyId, filters);

    const result = await pool.query(
      `SELECT pls.* FROM property_long_stays pls
       ${joinUnits}
       WHERE ${conditions.join(" AND ")}
       ORDER BY pls.lease_start_date DESC, pls.created_at DESC`,
      values
    );
    return result.rows.map((row) => mapPropertyLongStayRow(row as Record<string, unknown>));
  },

  async listPaginatedByProperty(
    propertyId: string,
    filters: TPropertyLongStaysListFilters,
    options: { cursor?: string; limit: number }
  ): Promise<{
    longStays: IPropertyLongStay[];
    meta?: IPropertyLongStaysListMeta;
    nextCursor: string | null;
  }> {
    const includeMeta = shouldIncludeListMeta(options.cursor);
    const listPromise = propertyLongStaysDb.listPaginatedPage(propertyId, filters, options);
    const metaPromise = includeMeta
      ? propertyLongStaysDb.getListMetaByProperty(propertyId, filters)
      : Promise.resolve(undefined);

    const [{ longStays, nextCursor }, meta] = await Promise.all([listPromise, metaPromise]);

    return meta == null ? { longStays, nextCursor } : { longStays, meta, nextCursor };
  },

  async listPaginatedPage(
    propertyId: string,
    filters: TPropertyLongStaysListFilters,
    options: { cursor?: string; limit: number }
  ): Promise<{ longStays: IPropertyLongStay[]; nextCursor: string | null }> {
    const { conditions, joinUnits, values } = buildPropertyLongStayListParts(propertyId, filters);
    let p = values.length + 1;

    if (options.cursor != null && options.cursor !== "") {
      const decoded = decodeLeaseKeysetCursor(options.cursor);
      conditions.push(
        `(pls.lease_start_date, pls.created_at, pls.id) < ($${p++}::date, $${p++}::timestamptz, $${p++}::uuid)`
      );
      values.push(decoded.leaseStartDate, decoded.createdAt, decoded.id);
    }

    const limitParam = p;
    values.push(options.limit + 1);

    const result = await pool.query(
      `SELECT pls.* FROM property_long_stays pls
       ${joinUnits}
       WHERE ${conditions.join(" AND ")}
       ORDER BY pls.lease_start_date DESC, pls.created_at DESC, pls.id DESC
       LIMIT $${limitParam}`,
      values
    );

    const rows = result.rows as Record<string, unknown>[];
    const { nextCursor, page: pageRows } = takePageWithNextCursor(rows, options.limit, (last) =>
      encodeLeaseKeysetCursor(
        formatLeaseStartDateForCursor(last.lease_start_date),
        last.created_at as Date | string,
        last.id as string
      )
    );

    return {
      longStays: pageRows.map((row) => mapPropertyLongStayRow(row)),
      nextCursor,
    };
  },

  async listRentPeriods(longStayId: string): Promise<IPropertyLongStayRentPeriod[]> {
    const result = await pool.query(
      `SELECT effective_from_month, monthly_rent
       FROM property_long_stay_rent_periods
       WHERE long_stay_id = $1
       ORDER BY effective_from_month ASC`,
      [longStayId]
    );
    return result.rows.map((row) =>
      mapPropertyLongStayRentPeriodRow(row as Record<string, unknown>)
    );
  },

  async updateLease(id: string, patch: IUpdatePropertyLongStayBody): Promise<IPropertyLongStay> {
    const setClauses: string[] = [];
    const values: unknown[] = [id];
    let paramIndex = 2;

    if (patch.guestName !== undefined) {
      setClauses.push(`guest_name = $${paramIndex++}`);
      values.push(patch.guestName.trim());
    }
    if (patch.tenantEmail !== undefined) {
      setClauses.push(`tenant_email = $${paramIndex++}`);
      values.push(patch.tenantEmail?.trim() || null);
    }
    if (patch.tenantPhone !== undefined) {
      setClauses.push(`tenant_phone = $${paramIndex++}`);
      values.push(patch.tenantPhone?.trim() || null);
    }
    if (patch.secondaryTenants !== undefined) {
      setClauses.push(`secondary_tenants = $${paramIndex++}::jsonb`);
      values.push(JSON.stringify(patch.secondaryTenants));
    }

    values.push(PropertyLongStayStatus.ACTIVE);
    const statusParamIndex = paramIndex;

    const result = await pool.query(
      `UPDATE property_long_stays
       SET ${setClauses.join(", ")}
       WHERE id = $1
         AND status = $${statusParamIndex}::property_long_stay_status
       RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      const existing = await propertyLongStaysDb.findById(id);
      if (!existing) {
        throw new LongStayNotFoundError();
      }
      throw new LongStayNotActiveError();
    }
    return mapPropertyLongStayRow(result.rows[0] as Record<string, unknown>);
  },
};
