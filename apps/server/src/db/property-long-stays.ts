import type {
  ICreatePropertyLongStayBody,
  IPropertyLongStay,
  IPropertyLongStayRentMonth,
  IPropertyLongStaySecondaryTenant,
  IPropertyLongStaysListQuery,
} from "@/packages/shared";
import {
  calculateLeaseEndDate,
  enumerateLeaseMonths,
  PropertyLongStayStatus,
  transactionDateToMonth,
} from "@/packages/shared";

import { mapPropertyLongStayRow } from "./mappers";
import { pool } from "./pool";

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

  async getRentSchedule(longStayId: string): Promise<IPropertyLongStayRentMonth[]> {
    const longStay = await propertyLongStaysDb.findById(longStayId);
    if (!longStay) {
      throw new LongStayNotFoundError();
    }

    const effectiveEndDate = longStay.actualEndDate ?? longStay.leaseEndDate;
    const months = enumerateLeaseMonths(longStay.leaseStartDate, effectiveEndDate);

    const incomeResult = await pool.query<{ id: string; transaction_date: Date }>(
      `SELECT id, transaction_date
       FROM property_income_lines
       WHERE long_stay_id = $1
         AND is_deleted = false
       ORDER BY transaction_date ASC`,
      [longStayId]
    );

    const paidByMonth = new Map<string, string>();
    for (const row of incomeResult.rows) {
      const month = transactionDateToMonth(
        row.transaction_date instanceof Date
          ? row.transaction_date.toISOString().slice(0, 10)
          : String(row.transaction_date)
      );
      if (!paidByMonth.has(month)) {
        paidByMonth.set(month, row.id);
      }
    }

    return months.map((month) => {
      const incomeLineId = paidByMonth.get(month);
      return {
        incomeLineId,
        isPaid: incomeLineId !== undefined,
        month,
      };
    });
  },

  async listByProperty(
    propertyId: string,
    filters: IPropertyLongStaysListQuery = {}
  ): Promise<IPropertyLongStay[]> {
    const conditions = ["property_id = $1"];
    const values: unknown[] = [propertyId];
    let p = 2;

    if (filters.status) {
      conditions.push(`status = $${p++}::property_long_stay_status`);
      values.push(filters.status);
    }
    if (filters.unitId) {
      conditions.push(`unit_id = $${p++}`);
      values.push(filters.unitId);
    }

    const result = await pool.query(
      `SELECT * FROM property_long_stays
       WHERE ${conditions.join(" AND ")}
       ORDER BY lease_start_date DESC, created_at DESC`,
      values
    );
    return result.rows.map((row) => mapPropertyLongStayRow(row as Record<string, unknown>));
  },

  async updateSecondaryTenants(
    id: string,
    secondaryTenants: IPropertyLongStaySecondaryTenant[]
  ): Promise<IPropertyLongStay> {
    const result = await pool.query(
      `UPDATE property_long_stays
       SET secondary_tenants = $2::jsonb
       WHERE id = $1
         AND status = $3::property_long_stay_status
       RETURNING *`,
      [id, JSON.stringify(secondaryTenants), PropertyLongStayStatus.ACTIVE]
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
