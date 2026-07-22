import type { PoolClient } from "pg";

import {
  DEFAULT_PROPERTY_EXPENSE_CATEGORY_TYPES,
  type IPropertyExpenseCategoryType,
  type IPropertyExpenseCategoryTypeInput,
  SYSTEM_PAYMENT_PROCESSING_EXPENSE_CATEGORY_NAME,
} from "@/packages/shared";

import { mapPropertyExpenseCategoryTypeRow } from "./mappers";
import { pool } from "./pool";
import {
  archivePropertyCatalogTypesNotInIds,
  restoreArchivedExpenseCategoryTypeByName,
} from "./property-catalog-type-utils";

const EXPENSE_CATEGORY_TYPE_SELECT =
  `id, property_id, name, sort_order, is_annual_amount, is_system` as const;

/** Keeps the system Payment processing category before user-managed types. */
const SYSTEM_PAYMENT_PROCESSING_SORT_ORDER = -1;

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

  async ensureSystemPaymentProcessingExpenseCategory(
    propertyId: string,
    client?: PoolClient
  ): Promise<IPropertyExpenseCategoryType> {
    const db = client ?? pool;
    const canonicalName = SYSTEM_PAYMENT_PROCESSING_EXPENSE_CATEGORY_NAME;
    const nameKey = canonicalName.toLowerCase();

    const active = await db.query(
      `SELECT ${EXPENSE_CATEGORY_TYPE_SELECT}
       FROM property_expense_category_types
       WHERE property_id = $1
         AND is_system = true
         AND is_deleted = false
         AND lower(name) = $2
       LIMIT 1`,
      [propertyId, nameKey]
    );
    if (active.rows.length > 0) {
      const row = active.rows[0] as Record<string, unknown>;
      const needsNormalize =
        String(row.name) !== canonicalName ||
        Number(row.sort_order) !== SYSTEM_PAYMENT_PROCESSING_SORT_ORDER;
      if (needsNormalize) {
        const normalized = await db.query(
          `UPDATE property_expense_category_types
           SET name = $1,
               sort_order = $2,
               is_annual_amount = false,
               updated_at = NOW()
           WHERE id = $3
           RETURNING ${EXPENSE_CATEGORY_TYPE_SELECT}`,
          [canonicalName, SYSTEM_PAYMENT_PROCESSING_SORT_ORDER, row.id]
        );
        return mapPropertyExpenseCategoryTypeRow(normalized.rows[0] as Record<string, unknown>);
      }
      return mapPropertyExpenseCategoryTypeRow(row);
    }

    const restored = await db.query(
      `UPDATE property_expense_category_types
       SET name = $1,
           sort_order = $2,
           is_annual_amount = false,
           is_deleted = false,
           deleted_at = NULL,
           is_system = true,
           updated_at = NOW()
       WHERE property_id = $3
         AND is_deleted = true
         AND lower(name) = $4
       RETURNING ${EXPENSE_CATEGORY_TYPE_SELECT}`,
      [canonicalName, SYSTEM_PAYMENT_PROCESSING_SORT_ORDER, propertyId, nameKey]
    );
    if (restored.rows.length > 0) {
      return mapPropertyExpenseCategoryTypeRow(restored.rows[0] as Record<string, unknown>);
    }

    const inserted = await db.query(
      `INSERT INTO property_expense_category_types
         (property_id, name, sort_order, is_annual_amount, is_system)
       VALUES ($1, $2, $3, false, true)
       RETURNING ${EXPENSE_CATEGORY_TYPE_SELECT}`,
      [propertyId, canonicalName, SYSTEM_PAYMENT_PROCESSING_SORT_ORDER]
    );
    return mapPropertyExpenseCategoryTypeRow(inserted.rows[0] as Record<string, unknown>);
  },

  async findByIdForProperty(
    typeId: string,
    propertyId: string,
    client?: PoolClient,
    activeOnly = false
  ): Promise<IPropertyExpenseCategoryType | null> {
    const db = client ?? pool;
    const result = await db.query(
      `SELECT ${EXPENSE_CATEGORY_TYPE_SELECT}
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
      `SELECT ${EXPENSE_CATEGORY_TYPE_SELECT}
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
    await propertyExpenseCategoryTypesDb.ensureSystemPaymentProcessingExpenseCategory(
      propertyId,
      client
    );

    const hasUserManagedRows = await db.query(
      `SELECT EXISTS(
         SELECT 1 FROM property_expense_category_types
         WHERE property_id = $1 AND is_system = false
       ) AS exists`,
      [propertyId]
    );
    if (Boolean(hasUserManagedRows.rows[0]?.exists)) {
      return;
    }

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
