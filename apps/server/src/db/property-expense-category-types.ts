import type { PoolClient } from "pg";

import {
  DEFAULT_PROPERTY_EXPENSE_CATEGORY_TYPES,
  type IPropertyExpenseCategoryType,
  type IPropertyExpenseCategoryTypeInput,
} from "@/packages/shared";

import { mapPropertyExpenseCategoryTypeRow } from "./mappers";
import { pool } from "./pool";
import {
  archivePropertyCatalogTypesNotInIds,
  propertyCatalogHasAnyRows,
  restoreArchivedExpenseCategoryTypeByName,
} from "./property-catalog-type-utils";

export const propertyExpenseCategoryTypesDb = {
  async countUsage(typeId: string, client?: PoolClient): Promise<number> {
    const db = client ?? pool;
    const result = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM property_expenses
       WHERE category_id = $1 AND is_deleted = false`,
      [typeId]
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  async findByIdForProperty(
    typeId: string,
    propertyId: string,
    client?: PoolClient,
    activeOnly = false
  ): Promise<IPropertyExpenseCategoryType | null> {
    const db = client ?? pool;
    const result = await db.query(
      `SELECT id, property_id, name, sort_order, is_annual_amount, is_system
       FROM property_expense_category_types
       WHERE id = $1 AND property_id = $2${activeOnly ? " AND is_deleted = false" : ""}`,
      [typeId, propertyId]
    );
    if (result.rows.length === 0) return null;
    return mapPropertyExpenseCategoryTypeRow(result.rows[0] as Record<string, unknown>);
  },

  async findByProperty(
    propertyId: string,
    client?: PoolClient
  ): Promise<IPropertyExpenseCategoryType[]> {
    const db = client ?? pool;
    const result = await db.query(
      `SELECT id, property_id, name, sort_order, is_annual_amount, is_system
       FROM property_expense_category_types
       WHERE property_id = $1 AND is_deleted = false
       ORDER BY sort_order ASC, created_at ASC`,
      [propertyId]
    );
    return result.rows.map((row) =>
      mapPropertyExpenseCategoryTypeRow(row as Record<string, unknown>)
    );
  },

  async replaceAll(
    propertyId: string,
    inputs: IPropertyExpenseCategoryTypeInput[],
    client?: PoolClient
  ): Promise<IPropertyExpenseCategoryType[]> {
    const db = client ?? pool;
    const incomingIds = inputs.flatMap((input) => (input.id != null ? [input.id] : []));

    await archivePropertyCatalogTypesNotInIds(
      db,
      "property_expense_category_types",
      propertyId,
      incomingIds
    );

    for (const input of inputs) {
      const name = input.name.trim();
      const isAnnualAmount = input.isAnnualAmount ?? false;
      if (input.id != null) {
        await db.query(
          `UPDATE property_expense_category_types
           SET name = $1,
               sort_order = $2,
               is_annual_amount = $3,
               is_deleted = false,
               deleted_at = NULL,
               updated_at = NOW()
           WHERE id = $4 AND property_id = $5`,
          [name, input.sortOrder, isAnnualAmount, input.id, propertyId]
        );
      } else {
        const restored = await restoreArchivedExpenseCategoryTypeByName(
          db,
          propertyId,
          name,
          input.sortOrder,
          isAnnualAmount
        );
        if (!restored) {
          await db.query(
            `INSERT INTO property_expense_category_types
               (property_id, name, sort_order, is_annual_amount, is_system)
             VALUES ($1, $2, $3, $4, false)`,
            [propertyId, name, input.sortOrder, isAnnualAmount]
          );
        }
      }
    }

    return propertyExpenseCategoryTypesDb.findByProperty(propertyId, client);
  },

  async seedDefaults(propertyId: string, client?: PoolClient): Promise<void> {
    const db = client ?? pool;
    const hasAnyRows = await propertyCatalogHasAnyRows(
      db,
      "property_expense_category_types",
      propertyId
    );
    if (hasAnyRows) return;

    for (let index = 0; index < DEFAULT_PROPERTY_EXPENSE_CATEGORY_TYPES.length; index += 1) {
      const categoryType = DEFAULT_PROPERTY_EXPENSE_CATEGORY_TYPES[index];
      if (categoryType == null) continue;
      await db.query(
        `INSERT INTO property_expense_category_types
           (property_id, name, sort_order, is_annual_amount, is_system)
         VALUES ($1, $2, $3, $4, false)`,
        [propertyId, categoryType.name, index, categoryType.isAnnualAmount]
      );
    }
  },
};
