import type {
  ICreatePropertyIncomeLineBody,
  IPropertyIncomeLine,
  IPropertyIncomeLineComputedFields,
  IPropertyIncomeLinesListQuery,
  IUpdatePropertyIncomeLineBody,
} from "@/packages/shared";

import { mapPropertyIncomeLineRow } from "./mappers";
import { pool } from "./pool";

const INCOME_LINE_SELECT = `
  SELECT
    pil.*,
    ilt.name AS income_line_type_name
  FROM property_income_lines pil
  INNER JOIN property_income_line_types ilt ON ilt.id = pil.income_line_type_id
`;

export const propertyIncomeLinesDb = {
  async create(
    propertyId: string,
    input: {
      amount: number;
      description: string | null;
      guestName: string | null;
      incomeLineTypeId: ICreatePropertyIncomeLineBody["incomeLineTypeId"];
      longStayId: string | null;
      reservationId: string | null;
      transactionDate: string;
      unitId: string | null;
    },
    computed: IPropertyIncomeLineComputedFields
  ): Promise<IPropertyIncomeLine> {
    const result = await pool.query(
      `INSERT INTO property_income_lines (
         property_id,
         unit_id,
         reservation_id,
         long_stay_id,
         income_line_type_id,
         amount,
         transaction_date,
         description,
         guest_name,
         gross_income,
         tax_breakdown,
         channel_commission,
         net_income
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9,
         $10, $11::jsonb, $12, $13
       )
       RETURNING *`,
      [
        propertyId,
        input.unitId,
        input.reservationId,
        input.longStayId,
        input.incomeLineTypeId,
        input.amount,
        input.transactionDate,
        input.description,
        input.guestName,
        computed.grossIncome,
        JSON.stringify(computed.taxBreakdown),
        computed.channelCommission,
        computed.netIncome,
      ]
    );
    const created = await propertyIncomeLinesDb.findById(result.rows[0].id as string);
    if (!created) {
      throw new Error("Failed to load created income line");
    }
    return created;
  },

  async findById(id: string): Promise<IPropertyIncomeLine | null> {
    const result = await pool.query(`${INCOME_LINE_SELECT} WHERE pil.id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return mapPropertyIncomeLineRow(result.rows[0] as Record<string, unknown>);
  },

  async findByProperty(
    propertyId: string,
    filters: IPropertyIncomeLinesListQuery = {},
    includeDeleted = false
  ): Promise<IPropertyIncomeLine[]> {
    const conditions = ["pil.property_id = $1"];
    const values: unknown[] = [propertyId];
    let p = 2;

    if (!includeDeleted) {
      conditions.push("pil.is_deleted = false");
    }

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
    if (filters.incomeLineTypeId) {
      conditions.push(`pil.income_line_type_id = $${p++}`);
      values.push(filters.incomeLineTypeId);
    }
    if (filters.reservationId) {
      conditions.push(`pil.reservation_id = $${p++}`);
      values.push(filters.reservationId);
    }
    if (filters.longStayId) {
      conditions.push(`pil.long_stay_id = $${p++}`);
      values.push(filters.longStayId);
    }

    const joinUnits = filters.rentalType
      ? "INNER JOIN property_units pu ON pu.id = pil.unit_id"
      : "";
    if (filters.rentalType) {
      conditions.push(`pu.rental_type = $${p++}::property_unit_rental_type`);
      values.push(filters.rentalType);
    }

    const result = await pool.query(
      `${INCOME_LINE_SELECT}
       ${joinUnits}
       WHERE ${conditions.join(" AND ")}
       ORDER BY pil.transaction_date DESC, pil.created_at DESC`,
      values
    );

    return result.rows.map((row) => mapPropertyIncomeLineRow(row as Record<string, unknown>));
  },

  async restore(id: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE property_income_lines SET is_deleted = false, deleted_at = NULL WHERE id = $1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  },

  async softDelete(id: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE property_income_lines SET is_deleted = true, deleted_at = NOW() WHERE id = $1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
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
    if (input.longStayId !== undefined) {
      setClauses.push(`long_stay_id = $${param++}`);
      values.push(input.longStayId);
    }
    if (input.incomeLineTypeId !== undefined) {
      setClauses.push(`income_line_type_id = $${param++}`);
      values.push(input.incomeLineTypeId);
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
    setClauses.push(`tax_breakdown = $${param++}::jsonb`);
    values.push(JSON.stringify(computed.taxBreakdown));
    setClauses.push(`channel_commission = $${param++}`);
    values.push(computed.channelCommission);
    setClauses.push(`net_income = $${param++}`);
    values.push(computed.netIncome);

    values.push(id);
    const result = await pool.query(
      `UPDATE property_income_lines SET ${setClauses.join(", ")} WHERE id = $${param} RETURNING id`,
      values
    );
    if (result.rows.length === 0) return null;
    return propertyIncomeLinesDb.findById(id);
  },
};
