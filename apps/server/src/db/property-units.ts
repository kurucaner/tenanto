import type {
  ICreatePropertyUnitBody,
  IPropertyUnit,
  IUpdatePropertyUnitBody,
} from "@/packages/shared";
import { UnitRentalType } from "@/packages/shared";

import { mapPropertyUnitRow } from "./mappers";
import { pool } from "./pool";

export interface IUnitDeleteBlockers {
  incomeLineCount: number;
  longStayCount: number;
  reservationCount: number;
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

  async getUnitDeleteBlockers(unitId: string): Promise<IUnitDeleteBlockers> {
    const result = await pool.query<{
      income_line_count: number;
      long_stay_count: number;
      reservation_count: number;
    }>(
      `SELECT
         (SELECT COUNT(*)::int FROM property_reservations WHERE unit_id = $1 AND is_deleted = false) AS reservation_count,
         (SELECT COUNT(*)::int FROM property_income_lines WHERE unit_id = $1 AND is_deleted = false) AS income_line_count,
         (SELECT COUNT(*)::int FROM property_long_stays WHERE unit_id = $1) AS long_stay_count`,
      [unitId]
    );
    const row = result.rows[0];
    return {
      incomeLineCount: row?.income_line_count ?? 0,
      longStayCount: row?.long_stay_count ?? 0,
      reservationCount: row?.reservation_count ?? 0,
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
