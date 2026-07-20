import type { PoolClient } from "pg";

import {
  DEFAULT_PROPERTY_INCOME_LINE_TYPES,
  type IPropertyIncomeLineType,
  type IPropertyIncomeLineTypeInput,
} from "@/packages/shared";

import { mapPropertyIncomeLineTypeRow } from "./mappers";
import { pool } from "./pool";
import {
  archivePropertyCatalogTypesNotInIds,
  propertyCatalogHasAnyRows,
  restoreArchivedIncomeLineTypeByName,
} from "./property-catalog-type-utils";

export const propertyIncomeLineTypesDb = {
  async countUsage(typeId: string, client?: PoolClient): Promise<number> {
    const db = client ?? pool;
    const result = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM property_income_lines
       WHERE income_line_type_id = $1 AND is_deleted = false`,
      [typeId]
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  async findByIdForProperty(
    typeId: string,
    propertyId: string,
    client?: PoolClient,
    activeOnly = false
  ): Promise<IPropertyIncomeLineType | null> {
    const db = client ?? pool;
    const result = await db.query(
      `SELECT id, property_id, name, sort_order
       FROM property_income_line_types
       WHERE id = $1 AND property_id = $2${activeOnly ? " AND is_deleted = false" : ""}`,
      [typeId, propertyId]
    );
    if (result.rows.length === 0) return null;
    return mapPropertyIncomeLineTypeRow(result.rows[0] as Record<string, unknown>);
  },

  async findByProperty(
    propertyId: string,
    client?: PoolClient
  ): Promise<IPropertyIncomeLineType[]> {
    const db = client ?? pool;
    const result = await db.query(
      `SELECT id, property_id, name, sort_order
       FROM property_income_line_types
       WHERE property_id = $1 AND is_deleted = false
       ORDER BY sort_order ASC, created_at ASC`,
      [propertyId]
    );
    return result.rows.map((row) => mapPropertyIncomeLineTypeRow(row as Record<string, unknown>));
  },

  async replaceAll(
    propertyId: string,
    inputs: IPropertyIncomeLineTypeInput[],
    client?: PoolClient
  ): Promise<IPropertyIncomeLineType[]> {
    const db = client ?? pool;
    const incomingIds = inputs.flatMap((input) => (input.id != null ? [input.id] : []));

    await archivePropertyCatalogTypesNotInIds(
      db,
      "property_income_line_types",
      propertyId,
      incomingIds
    );

    for (const input of inputs) {
      const name = input.name.trim();
      if (input.id != null) {
        await db.query(
          `UPDATE property_income_line_types
           SET name = $1,
               sort_order = $2,
               is_deleted = false,
               deleted_at = NULL,
               updated_at = NOW()
           WHERE id = $3 AND property_id = $4`,
          [name, input.sortOrder, input.id, propertyId]
        );
      } else {
        const restored = await restoreArchivedIncomeLineTypeByName(
          db,
          propertyId,
          name,
          input.sortOrder
        );
        if (!restored) {
          await db.query(
            `INSERT INTO property_income_line_types (property_id, name, sort_order)
             VALUES ($1, $2, $3)`,
            [propertyId, name, input.sortOrder]
          );
        }
      }
    }

    return propertyIncomeLineTypesDb.findByProperty(propertyId, client);
  },

  async seedDefaults(propertyId: string, client?: PoolClient): Promise<void> {
    const db = client ?? pool;
    const hasAnyRows = await propertyCatalogHasAnyRows(
      db,
      "property_income_line_types",
      propertyId
    );
    if (hasAnyRows) return;

    for (let index = 0; index < DEFAULT_PROPERTY_INCOME_LINE_TYPES.length; index += 1) {
      const incomeType = DEFAULT_PROPERTY_INCOME_LINE_TYPES[index];
      if (incomeType == null) continue;
      await db.query(
        `INSERT INTO property_income_line_types (property_id, name, sort_order)
         VALUES ($1, $2, $3)`,
        [propertyId, incomeType.name, index]
      );
    }
  },
};
