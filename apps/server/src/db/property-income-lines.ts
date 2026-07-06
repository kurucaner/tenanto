import type {
  ICreatePropertyIncomeLineBody,
  IPropertyIncomeLine,
  IPropertyIncomeLineComputedFields,
  IPropertyIncomeLinesListQuery,
  IUpdatePropertyIncomeLineBody,
} from "@/packages/shared";

import { mapPropertyIncomeLineRow } from "./mappers";
import { pool } from "./pool";

export const propertyIncomeLinesDb = {
  async create(
    propertyId: string,
    input: {
      amount: number;
      description: string | null;
      guestName: string | null;
      lineType: ICreatePropertyIncomeLineBody["lineType"];
      reservationId: string | null;
      transactionDate: string;
      unitId: string;
    },
    computed: IPropertyIncomeLineComputedFields
  ): Promise<IPropertyIncomeLine> {
    const result = await pool.query(
      `INSERT INTO property_income_lines (
         property_id,
         unit_id,
         reservation_id,
         line_type,
         amount,
         transaction_date,
         description,
         guest_name,
         gross_income,
         sales_tax,
         miami_dade_surtax,
         convention_development_tax,
         resort_tax,
         channel_commission,
         net_income
       ) VALUES (
         $1, $2, $3, $4::property_income_line_type, $5, $6, $7, $8,
         $9, $10, $11, $12, $13, $14, $15
       )
       RETURNING *`,
      [
        propertyId,
        input.unitId,
        input.reservationId,
        input.lineType,
        input.amount,
        input.transactionDate,
        input.description,
        input.guestName,
        computed.grossIncome,
        computed.salesTax,
        computed.miamiDadeSurtax,
        computed.conventionDevelopmentTax,
        computed.resortTax,
        computed.channelCommission,
        computed.netIncome,
      ]
    );
    return mapPropertyIncomeLineRow(result.rows[0] as Record<string, unknown>);
  },

  async delete(id: string): Promise<boolean> {
    const result = await pool.query(`DELETE FROM property_income_lines WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  },

  async findById(id: string): Promise<IPropertyIncomeLine | null> {
    const result = await pool.query(`SELECT * FROM property_income_lines WHERE id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return mapPropertyIncomeLineRow(result.rows[0] as Record<string, unknown>);
  },

  async findByProperty(
    propertyId: string,
    filters: IPropertyIncomeLinesListQuery = {}
  ): Promise<IPropertyIncomeLine[]> {
    const conditions = ["pil.property_id = $1"];
    const values: unknown[] = [propertyId];
    let p = 2;

    if (filters.from) {
      conditions.push(`pil.transaction_date >= $${p++}`);
      values.push(filters.from);
    }
    if (filters.to) {
      conditions.push(`pil.transaction_date <= $${p++}`);
      values.push(filters.to);
    }
    if (filters.unitId) {
      conditions.push(`pil.unit_id = $${p++}`);
      values.push(filters.unitId);
    }
    if (filters.lineType) {
      conditions.push(`pil.line_type = $${p++}::property_income_line_type`);
      values.push(filters.lineType);
    }
    if (filters.reservationId) {
      conditions.push(`pil.reservation_id = $${p++}`);
      values.push(filters.reservationId);
    }

    const joinUnits = filters.rentalType
      ? "INNER JOIN property_units pu ON pu.id = pil.unit_id"
      : "";
    if (filters.rentalType) {
      conditions.push(`pu.rental_type = $${p++}::property_unit_rental_type`);
      values.push(filters.rentalType);
    }

    const result = await pool.query(
      `SELECT pil.*
       FROM property_income_lines pil
       ${joinUnits}
       WHERE ${conditions.join(" AND ")}
       ORDER BY pil.transaction_date DESC, pil.created_at DESC`,
      values
    );

    return result.rows.map((row) =>
      mapPropertyIncomeLineRow(row as Record<string, unknown>)
    );
  },

  async update(
    id: string,
    input: IUpdatePropertyIncomeLineBody,
    computed: IPropertyIncomeLineComputedFields
  ): Promise<IPropertyIncomeLine | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let param = 1;

    if (input.unitId !== undefined) {
      setClauses.push(`unit_id = $${param++}`);
      values.push(input.unitId);
    }
    if (input.reservationId !== undefined) {
      setClauses.push(`reservation_id = $${param++}`);
      values.push(input.reservationId);
    }
    if (input.lineType !== undefined) {
      setClauses.push(`line_type = $${param++}::property_income_line_type`);
      values.push(input.lineType);
    }
    if (input.transactionDate !== undefined) {
      setClauses.push(`transaction_date = $${param++}`);
      values.push(input.transactionDate);
    }
    if (input.description !== undefined) {
      setClauses.push(`description = $${param++}`);
      values.push(input.description);
    }
    if (input.guestName !== undefined) {
      setClauses.push(`guest_name = $${param++}`);
      values.push(input.guestName);
    }
    if (input.amount !== undefined) {
      setClauses.push(`amount = $${param++}`);
      values.push(input.amount);
    }

    setClauses.push(`gross_income = $${param++}`);
    values.push(computed.grossIncome);
    setClauses.push(`sales_tax = $${param++}`);
    values.push(computed.salesTax);
    setClauses.push(`miami_dade_surtax = $${param++}`);
    values.push(computed.miamiDadeSurtax);
    setClauses.push(`convention_development_tax = $${param++}`);
    values.push(computed.conventionDevelopmentTax);
    setClauses.push(`resort_tax = $${param++}`);
    values.push(computed.resortTax);
    setClauses.push(`channel_commission = $${param++}`);
    values.push(computed.channelCommission);
    setClauses.push(`net_income = $${param++}`);
    values.push(computed.netIncome);

    values.push(id);
    const result = await pool.query(
      `UPDATE property_income_lines SET ${setClauses.join(", ")} WHERE id = $${param} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return null;
    return mapPropertyIncomeLineRow(result.rows[0] as Record<string, unknown>);
  },
};
