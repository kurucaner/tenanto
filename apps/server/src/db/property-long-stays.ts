import {
  activeLongStayConflictError,
  invalidExtendLeaseError,
  longStayNotActiveError,
  longStayNotFoundError,
} from "@/errors/lease-errors";
import { getTodayUtcIsoDate } from "@/lib/date-utils";
import type {
  ICreatePropertyLongStayBody,
  IEditPropertyLongStayTermsBody,
  IExtendPropertyLongStayBody,
  ILeaseTermsEditSignals,
  IPropertyLongStay,
  IPropertyLongStayRentMonth,
  IPropertyLongStayRentPeriod,
  IPropertyLongStaysListMeta,
  IUpdatePropertyLongStayBody,
  TPropertyLongStaysListFilters,
} from "@/packages/shared";
import {
  buildLeaseRentSchedule,
  enumerateLeaseSchedulePeriods,
  getCurrentLeaseRent,
  getLeaseRentAmount,
  getLeaseScheduleEffectiveEndDate,
  getPristineRentPeriodKey,
  hasRentPeriodHistory,
  parseRentBillingCadence,
  PropertyLongStayStatus,
  RentBillingCadence,
  resolveCreateLeaseRentAmount,
  resolveExtendLeaseEndDate,
  resolveExtendNewRentAmount,
  resolveExtendRentEffectivePeriod,
  resolveLeaseEndDate,
  resolveTermsEditRentAmount,
  validateExtendLease,
} from "@/packages/shared";
import { decodeLeaseKeysetCursor, encodeLeaseKeysetCursor } from "@/pagination/keyset-cursor";
import { takePageWithNextCursor } from "@/pagination/limit-plus-one";
import { shouldIncludeListMeta } from "@/pagination/should-include-list-meta";
import { hydrateLongStaysSecondaryOccupantNames } from "@/services/hydrate-long-stays-secondary-occupant-names";

import {
  mapPropertyIncomeLineRow,
  mapPropertyLongStayRentPeriodRow,
  mapPropertyLongStayRow,
} from "./mappers";
import { pool } from "./pool";
import {
  buildPropertyLongStaysCursorPredicate,
  buildPropertyLongStaysOrderByClause,
  needsUnitJoinForLeaseSort,
  readPropertyLongStaySortKeyFromRow,
  resolvePropertyLongStaysListSort,
} from "./property-long-stays-list-sort";
import { tenantRentPaymentsDb } from "./tenant-rent-payments";

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
    )`);
    values.push(pattern, pattern, pattern, pattern, pattern);
  }

  return { conditions, joinUnits, values };
}

function ensureUnitJoin(joinUnits: string): string {
  if (joinUnits) {
    return joinUnits;
  }
  return "LEFT JOIN property_units pu ON pu.id = pls.unit_id";
}

export const propertyLongStaysDb = {
  async create(propertyId: string, input: ICreatePropertyLongStayBody): Promise<IPropertyLongStay> {
    const activeLease = await propertyLongStaysDb.findActiveByUnitId(input.unitId);
    if (activeLease) {
      throw activeLongStayConflictError();
    }

    const { leaseEndDate, termMonths } = resolveLeaseEndDate(input);
    const tenantEmail = input.tenantEmail?.trim() || null;
    const tenantPhone = input.tenantPhone?.trim() || null;
    const rentBillingCadence = input.rentBillingCadence ?? RentBillingCadence.MONTHLY;

    const rentAmount = resolveCreateLeaseRentAmount(input);
    if (rentAmount === undefined) {
      throw new Error("rentAmount is required");
    }

    const securityDepositAmount =
      input.securityDepositAmount === undefined ? null : input.securityDepositAmount;
    const securityDepositTracksRent =
      securityDepositAmount == null ? false : (input.securityDepositTracksRent ?? false);

    const result = await pool.query(
      `INSERT INTO property_long_stays
         (property_id, unit_id, guest_name, lease_start_date, term_months, rent_amount,
          lease_end_date, tenant_email, tenant_phone, status, rent_billing_cadence,
          security_deposit_amount, security_deposit_tracks_rent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::property_long_stay_status,
               $11::rent_billing_cadence, $12, $13)
       RETURNING *`,
      [
        propertyId,
        input.unitId,
        input.guestName.trim(),
        input.leaseStartDate,
        termMonths,
        rentAmount,
        leaseEndDate,
        tenantEmail,
        tenantPhone,
        PropertyLongStayStatus.ACTIVE,
        rentBillingCadence,
        securityDepositAmount,
        securityDepositTracksRent,
      ]
    );
    const longStay = mapPropertyLongStayRow(result.rows[0] as Record<string, unknown>);

    return longStay;
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
        throw longStayNotFoundError();
      }
      throw longStayNotActiveError();
    }
    return mapPropertyLongStayRow(result.rows[0] as Record<string, unknown>);
  },

  async extendLease(id: string, body: IExtendPropertyLongStayBody): Promise<IPropertyLongStay> {
    const existing = await propertyLongStaysDb.findById(id);
    if (!existing) {
      throw longStayNotFoundError();
    }
    if (existing.status !== PropertyLongStayStatus.ACTIVE) {
      throw longStayNotActiveError();
    }

    const validationError = validateExtendLease(body, existing, getTodayUtcIsoDate());
    if (validationError) {
      throw invalidExtendLeaseError(validationError);
    }

    const { newLeaseEndDate, newTermMonths } = resolveExtendLeaseEndDate(existing, body);
    const newRentAmount = resolveExtendNewRentAmount(body);
    const rentEffectiveFromPeriod = resolveExtendRentEffectivePeriod(body);
    const hasRentChange = newRentAmount !== undefined && rentEffectiveFromPeriod !== undefined;

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
               (long_stay_id, effective_from_period, rent_amount)
             VALUES ($1, $2, $3)`,
            [
              id,
              getPristineRentPeriodKey(existing.leaseStartDate, existing.rentBillingCadence),
              getLeaseRentAmount(existing),
            ]
          );
        }

        await client.query(
          `INSERT INTO property_long_stay_rent_periods
             (long_stay_id, effective_from_period, rent_amount)
           VALUES ($1, $2, $3)`,
          [id, rentEffectiveFromPeriod, newRentAmount]
        );
      }

      const rentPeriodsResult = await client.query(
        `SELECT effective_from_period, rent_amount
         FROM property_long_stay_rent_periods
         WHERE long_stay_id = $1
         ORDER BY effective_from_period ASC`,
        [id]
      );
      const rentPeriods = rentPeriodsResult.rows.map((row) =>
        mapPropertyLongStayRentPeriodRow(row as Record<string, unknown>)
      );
      const currentRentAmount = getCurrentLeaseRent(
        getLeaseRentAmount(existing),
        rentPeriods,
        getTodayUtcIsoDate(),
        existing
      );

      const result = await client.query(
        `UPDATE property_long_stays
         SET term_months = $2,
             lease_end_date = $3,
             rent_amount = $4
         WHERE id = $1
           AND status = $5::property_long_stay_status
         RETURNING *`,
        [id, newTermMonths, newLeaseEndDate, currentRentAmount, PropertyLongStayStatus.ACTIVE]
      );

      if (result.rows.length === 0) {
        throw longStayNotActiveError();
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
      throw longStayNotFoundError();
    }

    const rentPeriods = await propertyLongStaysDb.listRentPeriods(longStayId);
    const effectiveEndDate = getLeaseScheduleEffectiveEndDate(longStay, referenceDate);

    const incomeResult = await pool.query(
      `SELECT pil.*, ilt.name AS income_line_type_name
       FROM property_income_lines pil
       INNER JOIN property_income_line_types ilt ON ilt.id = pil.income_line_type_id
       WHERE pil.long_stay_id = $1
         AND pil.is_deleted = false
       ORDER BY pil.transaction_date ASC`,
      [longStayId]
    );

    const incomeLines = incomeResult.rows.map((row) =>
      mapPropertyIncomeLineRow(row as Record<string, unknown>)
    );

    const allocationTotals = await tenantRentPaymentsDb.sumSucceededAllocatedCentsByMonths(
      longStayId,
      enumerateLeaseSchedulePeriods(longStay, effectiveEndDate)
    );

    return buildLeaseRentSchedule({
      allocationCentsByMonth: allocationTotals,
      effectiveEndDate,
      incomeLines,
      lease: longStay,
      rentPeriods,
    });
  },

  async getTermsEditSignals(longStayId: string): Promise<{
    leaseStartDate: string;
    signals: ILeaseTermsEditSignals;
  } | null> {
    const result = await pool.query(
      `SELECT
         pls.lease_start_date,
         pls.rent_billing_cadence,
         EXISTS (
           SELECT 1
           FROM property_income_lines pil
           WHERE pil.long_stay_id = pls.id
             AND pil.is_deleted = false
         ) AS has_income_lines,
         EXISTS (
           SELECT 1
           FROM tenant_rent_payments trp
           WHERE trp.lease_id = pls.id
             AND trp.status = 'succeeded'::tenant_rent_payment_status
         ) AS has_succeeded_payments
       FROM property_long_stays pls
       WHERE pls.id = $1`,
      [longStayId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as Record<string, unknown>;
    const leaseStartDate =
      row.lease_start_date instanceof Date
        ? row.lease_start_date.toISOString().slice(0, 10)
        : String(row.lease_start_date).slice(0, 10);
    const rentBillingCadence =
      parseRentBillingCadence(row.rent_billing_cadence) ?? RentBillingCadence.MONTHLY;
    const rentPeriods = await propertyLongStaysDb.listRentPeriods(longStayId);

    return {
      leaseStartDate,
      signals: {
        hasIncomeLines: row.has_income_lines === true,
        hasRentPeriodHistory: hasRentPeriodHistory(rentPeriods, leaseStartDate, rentBillingCadence),
        hasSucceededPayments: row.has_succeeded_payments === true,
      },
    };
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
    const sort = resolvePropertyLongStaysListSort(filters.sortBy, filters.sortDir);
    const { conditions, joinUnits, values } = buildPropertyLongStayListParts(propertyId, filters);
    const resolvedJoinUnits = needsUnitJoinForLeaseSort(sort.sortBy)
      ? ensureUnitJoin(joinUnits)
      : joinUnits;
    let p = values.length + 1;

    if (options.cursor != null && options.cursor !== "") {
      const decoded = decodeLeaseKeysetCursor(options.cursor);
      if (decoded.sortBy !== sort.sortBy || decoded.sortDir !== sort.sortDir) {
        throw new Error("Invalid cursor");
      }

      const { nextParamIndex, predicate } = buildPropertyLongStaysCursorPredicate(sort, p);
      conditions.push(predicate);
      values.push(decoded.sortKey, decoded.createdAt, decoded.id);
      p = nextParamIndex;
    }

    const limitParam = p;
    values.push(options.limit + 1);
    const orderByClause = buildPropertyLongStaysOrderByClause(sort);
    const unitNumberSelect = sort.sortBy === "unit" ? ", pu.unit_number AS unit_number" : "";

    const result = await pool.query(
      `SELECT pls.*${unitNumberSelect} FROM property_long_stays pls
       ${resolvedJoinUnits}
       WHERE ${conditions.join(" AND ")}
       ${orderByClause}
       LIMIT $${limitParam}`,
      values
    );

    const rows = result.rows as Record<string, unknown>[];
    const { nextCursor, page: pageRows } = takePageWithNextCursor(rows, options.limit, (last) =>
      encodeLeaseKeysetCursor({
        createdAt: last.created_at as Date | string,
        id: last.id as string,
        sortBy: sort.sortBy,
        sortDir: sort.sortDir,
        sortKey: readPropertyLongStaySortKeyFromRow(sort, last),
      })
    );

    const longStays = await hydrateLongStaysSecondaryOccupantNames(
      pageRows.map((row) => mapPropertyLongStayRow(row))
    );

    return {
      longStays,
      nextCursor,
    };
  },

  async listRentPeriods(longStayId: string): Promise<IPropertyLongStayRentPeriod[]> {
    const result = await pool.query(
      `SELECT effective_from_period, rent_amount
       FROM property_long_stay_rent_periods
       WHERE long_stay_id = $1
       ORDER BY effective_from_period ASC`,
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
        throw longStayNotFoundError();
      }
      throw longStayNotActiveError();
    }
    return mapPropertyLongStayRow(result.rows[0] as Record<string, unknown>);
  },

  async updateTerms(id: string, body: IEditPropertyLongStayTermsBody): Promise<IPropertyLongStay> {
    const existing = await propertyLongStaysDb.findById(id);
    if (!existing) {
      throw longStayNotFoundError();
    }
    if (existing.status !== PropertyLongStayStatus.ACTIVE) {
      throw longStayNotActiveError();
    }

    const resolvedTerms = resolveLeaseEndDate(body);
    const hasCustomEndInBody = body.leaseEndDate !== undefined && body.leaseEndDate !== "";
    const scheduleChanged =
      body.leaseStartDate !== existing.leaseStartDate ||
      (hasCustomEndInBody
        ? resolvedTerms.leaseEndDate !== existing.leaseEndDate
        : body.termMonths !== undefined && body.termMonths !== existing.termMonths);
    if (scheduleChanged) {
      const activeOnUnit = await propertyLongStaysDb.findActiveByUnitId(existing.unitId);
      if (activeOnUnit && activeOnUnit.id !== id) {
        throw activeLongStayConflictError();
      }
    }

    const { leaseEndDate, termMonths } = resolvedTerms;
    const pristinePeriodKey = getPristineRentPeriodKey(
      body.leaseStartDate,
      existing.rentBillingCadence
    );

    const rentAmount = resolveTermsEditRentAmount(body);
    const securityDepositAmount =
      body.securityDepositAmount === undefined
        ? existing.securityDepositAmount
        : body.securityDepositAmount;
    const securityDepositTracksRent =
      securityDepositAmount == null
        ? false
        : (body.securityDepositTracksRent ?? existing.securityDepositTracksRent);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const rentPeriodsResult = await client.query(
        `SELECT id
         FROM property_long_stay_rent_periods
         WHERE long_stay_id = $1
         ORDER BY effective_from_period ASC`,
        [id]
      );

      if (rentPeriodsResult.rows.length === 1) {
        await client.query(
          `UPDATE property_long_stay_rent_periods
           SET effective_from_period = $2,
               rent_amount = $3
           WHERE long_stay_id = $1`,
          [id, pristinePeriodKey, rentAmount]
        );
      }

      const result = await client.query(
        `UPDATE property_long_stays
         SET lease_start_date = $2,
             term_months = $3,
             rent_amount = $4,
             lease_end_date = $5,
             security_deposit_amount = $6,
             security_deposit_tracks_rent = $7
         WHERE id = $1
           AND status = $8::property_long_stay_status
         RETURNING *`,
        [
          id,
          body.leaseStartDate,
          termMonths,
          rentAmount,
          leaseEndDate,
          securityDepositAmount,
          securityDepositTracksRent,
          PropertyLongStayStatus.ACTIVE,
        ]
      );

      if (result.rows.length === 0) {
        throw longStayNotActiveError();
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
};
