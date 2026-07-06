import type {
  ICreatePropertyUnitBody,
  IPropertyUnit,
  IUpdatePropertyUnitBody,
} from "@/packages/shared";

import { mapPropertyUnitRow } from "./mappers";
import { pool } from "./pool";

export const propertyUnitsDb = {
  async create(propertyId: string, input: ICreatePropertyUnitBody): Promise<IPropertyUnit> {
    const result = await pool.query(
      `INSERT INTO property_units (property_id, unit_number, rental_type, layout)
       VALUES ($1, $2, $3::property_unit_rental_type, $4)
       RETURNING *`,
      [propertyId, input.unitNumber.trim(), input.rentalType, input.layout.trim()]
    );
    return mapPropertyUnitRow(result.rows[0] as Record<string, unknown>);
  },

  async delete(id: string): Promise<boolean> {
    const result = await pool.query(`DELETE FROM property_units WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  },

  async findById(id: string): Promise<IPropertyUnit | null> {
    const result = await pool.query(`SELECT * FROM property_units WHERE id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return mapPropertyUnitRow(result.rows[0] as Record<string, unknown>);
  },

  async findByProperty(propertyId: string): Promise<IPropertyUnit[]> {
    const result = await pool.query(
      `SELECT * FROM property_units
       WHERE property_id = $1
       ORDER BY unit_number ASC`,
      [propertyId]
    );
    return result.rows.map((row) => mapPropertyUnitRow(row as Record<string, unknown>));
  },

  async update(id: string, input: IUpdatePropertyUnitBody): Promise<IPropertyUnit | null> {
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

    if (setClauses.length === 0) return propertyUnitsDb.findById(id);

    values.push(id);
    const result = await pool.query(
      `UPDATE property_units SET ${setClauses.join(", ")} WHERE id = $${p} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return null;
    return mapPropertyUnitRow(result.rows[0] as Record<string, unknown>);
  },
};
