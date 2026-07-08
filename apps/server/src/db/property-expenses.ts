import type {
  ICreatePropertyExpenseBody,
  IPropertyExpense,
  IPropertyExpensesListQuery,
  IUpdatePropertyExpenseBody,
} from "@/packages/shared";

import { mapPropertyExpenseRow } from "./mappers";
import { pool } from "./pool";

export const propertyExpensesDb = {
  async create(
    propertyId: string,
    input: {
      amount: number;
      category: ICreatePropertyExpenseBody["category"];
      description: string | null;
      expenseDate: string | null;
      personName: string | null;
      taxFree: boolean;
    }
  ): Promise<IPropertyExpense> {
    const result = await pool.query(
      `INSERT INTO property_expenses (
         property_id,
         category,
         amount,
         expense_date,
         person_name,
         description,
         tax_free
       ) VALUES ($1, $2::property_expense_category, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        propertyId,
        input.category,
        input.amount,
        input.expenseDate,
        input.personName,
        input.description,
        input.taxFree,
      ]
    );
    return mapPropertyExpenseRow(result.rows[0] as Record<string, unknown>);
  },

  async findById(id: string): Promise<IPropertyExpense | null> {
    const result = await pool.query(`SELECT * FROM property_expenses WHERE id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return mapPropertyExpenseRow(result.rows[0] as Record<string, unknown>);
  },

  async findByProperty(
    propertyId: string,
    filters: IPropertyExpensesListQuery = {},
    includeDeleted = false
  ): Promise<IPropertyExpense[]> {
    const conditions = ["property_id = $1"];
    const values: unknown[] = [propertyId];
    let p = 2;

    if (!includeDeleted) {
      conditions.push("is_deleted = false");
    }

    if (filters.from) {
      conditions.push(`expense_date >= $${p++}`);
      values.push(filters.from);
    }
    if (filters.to) {
      conditions.push(`expense_date <= $${p++}`);
      values.push(filters.to);
    }
    if (filters.category) {
      conditions.push(`category = $${p++}::property_expense_category`);
      values.push(filters.category);
    }

    const result = await pool.query(
      `SELECT * FROM property_expenses
       WHERE ${conditions.join(" AND ")}
       ORDER BY expense_date DESC NULLS LAST, created_at DESC`,
      values
    );

    return result.rows.map((row) => mapPropertyExpenseRow(row as Record<string, unknown>));
  },

  async restore(id: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE property_expenses SET is_deleted = false, deleted_at = NULL WHERE id = $1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  },

  async softDelete(id: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE property_expenses SET is_deleted = true, deleted_at = NOW() WHERE id = $1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  },

  async update(id: string, input: IUpdatePropertyExpenseBody): Promise<IPropertyExpense | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let param = 1;

    if (input.category !== undefined) {
      setClauses.push(`category = $${param++}::property_expense_category`);
      values.push(input.category);
    }
    if (input.amount !== undefined) {
      setClauses.push(`amount = $${param++}`);
      values.push(input.amount);
    }
    if (input.expenseDate !== undefined) {
      setClauses.push(`expense_date = $${param++}`);
      values.push(input.expenseDate);
    }
    if (input.personName !== undefined) {
      setClauses.push(`person_name = $${param++}`);
      values.push(input.personName);
    }
    if (input.description !== undefined) {
      setClauses.push(`description = $${param++}`);
      values.push(input.description);
    }
    if (input.taxFree !== undefined) {
      setClauses.push(`tax_free = $${param++}`);
      values.push(input.taxFree);
    }

    if (setClauses.length === 0) {
      return propertyExpensesDb.findById(id);
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE property_expenses SET ${setClauses.join(", ")} WHERE id = $${param} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return null;
    return mapPropertyExpenseRow(result.rows[0] as Record<string, unknown>);
  },
};
