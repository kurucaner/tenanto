import type {
  ICreatePropertyExpenseBody,
  IPropertyExpense,
  IPropertyExpensesListMeta,
  IPropertyExpensesListQuery,
  IUpdatePropertyExpenseBody,
  TPropertyExpensesListFilters,
} from "@/packages/shared";
import { decodeExpenseKeysetCursor, encodeExpenseKeysetCursor } from "@/pagination/keyset-cursor";
import { takePageWithNextCursor } from "@/pagination/limit-plus-one";
import { shouldIncludeListMeta } from "@/pagination/should-include-list-meta";

import { mapPropertyExpenseRow } from "./mappers";
import { pool } from "./pool";

const EXPENSE_DATE_COALESCE = "COALESCE(pe.expense_date, DATE '0001-01-01')";

const EXPENSE_SELECT = `
  SELECT
    pe.*,
    pect.name        AS category_name,
    pect.is_annual_amount
  FROM property_expenses pe
  JOIN property_expense_category_types pect ON pe.category_id = pect.id
`;

export function buildPropertyExpenseListConditions(
  propertyId: string,
  filters: TPropertyExpensesListFilters,
  includeDeleted: boolean
): { conditions: string[]; values: unknown[] } {
  const conditions = ["pe.property_id = $1"];
  const values: unknown[] = [propertyId];
  let p = 2;

  if (!includeDeleted) {
    conditions.push("pe.is_deleted = false");
  }

  if (filters.from) {
    conditions.push(`pe.expense_date >= $${p++}`);
    values.push(filters.from);
  }
  if (filters.to) {
    conditions.push(`pe.expense_date <= $${p++}`);
    values.push(filters.to);
  }
  if (filters.categoryId) {
    conditions.push(`pe.category_id = $${p++}::uuid`);
    values.push(filters.categoryId);
  }

  const qTrim = filters.q?.trim();
  if (qTrim) {
    conditions.push(`(pe.description ILIKE $${p++} OR pect.name ILIKE $${p++})`);
    const pattern = `%${qTrim}%`;
    values.push(pattern, pattern);
  }

  return { conditions, values };
}

function formatExpenseDateForCursor(expenseDate: unknown): string | null {
  if (expenseDate == null) {
    return null;
  }
  if (expenseDate instanceof Date) {
    return expenseDate.toISOString().slice(0, 10);
  }
  if (typeof expenseDate === "string") {
    return expenseDate.slice(0, 10);
  }
  return null;
}

export const propertyExpensesDb = {
  async create(
    propertyId: string,
    input: {
      amount: number;
      categoryId: ICreatePropertyExpenseBody["categoryId"];
      description: string | null;
      expenseDate: string | null;
      taxFree: boolean;
    }
  ): Promise<IPropertyExpense> {
    const result = await pool.query(
      `WITH inserted AS (
         INSERT INTO property_expenses
           (property_id, category_id, amount, expense_date, description, tax_free)
         VALUES ($1, $2::uuid, $3, $4, $5, $6)
         RETURNING id
       )
       SELECT
         pe.*,
         pect.name        AS category_name,
         pect.is_annual_amount
       FROM property_expenses pe
       JOIN property_expense_category_types pect ON pe.category_id = pect.id
       JOIN inserted i ON pe.id = i.id`,
      [
        propertyId,
        input.categoryId,
        input.amount,
        input.expenseDate,
        input.description,
        input.taxFree,
      ]
    );
    return mapPropertyExpenseRow(result.rows[0] as Record<string, unknown>);
  },

  async createMany(
    propertyId: string,
    inputs: Array<{
      amount: number;
      categoryId: ICreatePropertyExpenseBody["categoryId"];
      description: string | null;
      expenseDate: string | null;
      taxFree: boolean;
    }>
  ): Promise<IPropertyExpense[]> {
    if (inputs.length === 0) {
      return [];
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const expenses: IPropertyExpense[] = [];

      for (const input of inputs) {
        const insertResult = await client.query(
          `INSERT INTO property_expenses
             (property_id, category_id, amount, expense_date, description, tax_free)
           VALUES ($1, $2::uuid, $3, $4, $5, $6)
           RETURNING id`,
          [
            propertyId,
            input.categoryId,
            input.amount,
            input.expenseDate,
            input.description,
            input.taxFree,
          ]
        );
        const id = (insertResult.rows[0] as Record<string, unknown>).id as string;
        const selectResult = await client.query(`${EXPENSE_SELECT} WHERE pe.id = $1`, [id]);
        expenses.push(mapPropertyExpenseRow(selectResult.rows[0] as Record<string, unknown>));
      }

      await client.query("COMMIT");
      return expenses;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async findById(id: string): Promise<IPropertyExpense | null> {
    const result = await pool.query(`${EXPENSE_SELECT} WHERE pe.id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return mapPropertyExpenseRow(result.rows[0] as Record<string, unknown>);
  },

  async findByProperty(
    propertyId: string,
    filters: IPropertyExpensesListQuery = {},
    includeDeleted = false
  ): Promise<IPropertyExpense[]> {
    const { conditions, values } = buildPropertyExpenseListConditions(
      propertyId,
      filters,
      includeDeleted
    );

    const result = await pool.query(
      `${EXPENSE_SELECT}
       WHERE ${conditions.join(" AND ")}
       ORDER BY pe.expense_date DESC NULLS LAST, pe.created_at DESC`,
      values
    );

    return result.rows.map((row) => mapPropertyExpenseRow(row as Record<string, unknown>));
  },

  async getListMetaByProperty(
    propertyId: string,
    filters: TPropertyExpensesListFilters,
    includeDeleted = false
  ): Promise<IPropertyExpensesListMeta> {
    const { conditions, values } = buildPropertyExpenseListConditions(
      propertyId,
      filters,
      includeDeleted
    );

    const result = await pool.query<{
      total_count: number;
    }>(
      `SELECT COUNT(*)::int AS total_count
       FROM property_expenses pe
       JOIN property_expense_category_types pect ON pe.category_id = pect.id
       WHERE ${conditions.join(" AND ")}`,
      values
    );

    const row = result.rows[0];
    return {
      totalCount: row?.total_count ?? 0,
    };
  },

  async listPaginatedByProperty(
    propertyId: string,
    filters: TPropertyExpensesListFilters,
    options: { cursor?: string; includeDeleted?: boolean; limit: number }
  ): Promise<{
    expenses: IPropertyExpense[];
    meta?: IPropertyExpensesListMeta;
    nextCursor: string | null;
  }> {
    const includeDeleted = options.includeDeleted ?? false;
    const includeMeta = shouldIncludeListMeta(options.cursor);
    const listPromise = propertyExpensesDb.listPaginatedPage(propertyId, filters, options);
    const metaPromise = includeMeta
      ? propertyExpensesDb.getListMetaByProperty(propertyId, filters, includeDeleted)
      : Promise.resolve(undefined);

    const [{ expenses, nextCursor }, meta] = await Promise.all([listPromise, metaPromise]);

    return meta == null ? { expenses, nextCursor } : { expenses, meta, nextCursor };
  },

  async listPaginatedPage(
    propertyId: string,
    filters: TPropertyExpensesListFilters,
    options: { cursor?: string; includeDeleted?: boolean; limit: number }
  ): Promise<{ expenses: IPropertyExpense[]; nextCursor: string | null }> {
    const includeDeleted = options.includeDeleted ?? false;
    const { conditions, values } = buildPropertyExpenseListConditions(
      propertyId,
      filters,
      includeDeleted
    );
    let p = values.length + 1;

    if (options.cursor != null && options.cursor !== "") {
      const decoded = decodeExpenseKeysetCursor(options.cursor);
      const cursorCoalescedDate = decoded.expenseDate ?? "0001-01-01";
      conditions.push(
        `(${EXPENSE_DATE_COALESCE}, pe.created_at, pe.id) < ($${p++}::date, $${p++}::timestamptz, $${p++}::uuid)`
      );
      values.push(cursorCoalescedDate, decoded.createdAt, decoded.id);
    }

    const limitParam = p;
    values.push(options.limit + 1);

    const result = await pool.query(
      `${EXPENSE_SELECT}
       WHERE ${conditions.join(" AND ")}
       ORDER BY ${EXPENSE_DATE_COALESCE} DESC, pe.created_at DESC, pe.id DESC
       LIMIT $${limitParam}`,
      values
    );

    const rows = result.rows as Record<string, unknown>[];
    const { nextCursor, page: pageRows } = takePageWithNextCursor(rows, options.limit, (last) =>
      encodeExpenseKeysetCursor(
        formatExpenseDateForCursor(last.expense_date),
        last.created_at as Date | string,
        last.id as string
      )
    );

    return {
      expenses: pageRows.map((row) => mapPropertyExpenseRow(row)),
      nextCursor,
    };
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

    if (input.categoryId !== undefined) {
      setClauses.push(`category_id = $${param++}::uuid`);
      values.push(input.categoryId);
    }
    if (input.amount !== undefined) {
      setClauses.push(`amount = $${param++}`);
      values.push(input.amount);
    }
    if (input.expenseDate !== undefined) {
      setClauses.push(`expense_date = $${param++}`);
      values.push(input.expenseDate);
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
    const updateResult = await pool.query(
      `UPDATE property_expenses SET ${setClauses.join(", ")} WHERE id = $${param} RETURNING id`,
      values
    );
    if (updateResult.rows.length === 0) return null;
    return propertyExpensesDb.findById(id);
  },
};
