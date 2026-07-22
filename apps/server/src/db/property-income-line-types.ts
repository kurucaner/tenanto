import type { PoolClient } from "pg";

import {
  DEFAULT_PROPERTY_INCOME_LINE_TYPES,
  DEFAULT_RENT_TYPE_NAME,
  type IPropertyIncomeLineType,
  type IPropertyIncomeLineTypeInput,
  SYSTEM_LEASE_RENT_INCOME_TYPE_NAME,
  SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME,
} from "@/packages/shared";

import { mapPropertyIncomeLineTypeRow } from "./mappers";
import { pool } from "./pool";
import {
  archivePropertyCatalogTypesNotInIds,
  restoreArchivedIncomeLineTypeByName,
} from "./property-catalog-type-utils";

const INCOME_LINE_TYPE_SELECT = `id, property_id, name, sort_order`;

/** Sort orders keep system types before user-managed types (-1 rent, -2 deposit). */
const SYSTEM_LEASE_RENT_SORT_ORDER = -1;
const SYSTEM_SECURITY_DEPOSIT_SORT_ORDER = -2;

function mapIncomeLineTypeRows(rows: Record<string, unknown>[]): IPropertyIncomeLineType[] {
  return rows.map((row) => mapPropertyIncomeLineTypeRow(row));
}

async function ensureSystemIncomeLineType(
  propertyId: string,
  name: string,
  sortOrder: number,
  client?: PoolClient,
  alternateNames: readonly string[] = []
): Promise<IPropertyIncomeLineType> {
  const db = client ?? pool;
  const matchNames = [name, ...alternateNames];

  const active = await db.query(
    `SELECT ${INCOME_LINE_TYPE_SELECT}
     FROM property_income_line_types
     WHERE property_id = $1
       AND is_system = true
       AND is_deleted = false
       AND lower(name) = ANY($2::text[])
     LIMIT 1`,
    [propertyId, matchNames.map((matchName) => matchName.toLowerCase())]
  );
  if (active.rows.length > 0) {
    const row = active.rows[0] as Record<string, unknown>;
    if (String(row.name).toLowerCase() !== name.toLowerCase()) {
      const renamed = await db.query(
        `UPDATE property_income_line_types
         SET name = $1,
             sort_order = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING ${INCOME_LINE_TYPE_SELECT}`,
        [name, sortOrder, row.id]
      );
      return mapPropertyIncomeLineTypeRow(renamed.rows[0] as Record<string, unknown>);
    }
    return mapPropertyIncomeLineTypeRow(row);
  }

  const restored = await db.query(
    `UPDATE property_income_line_types
     SET name = $1,
         sort_order = $2,
         is_deleted = false,
         deleted_at = NULL,
         is_system = true,
         updated_at = NOW()
     WHERE property_id = $3
       AND is_system = true
       AND is_deleted = true
       AND lower(name) = ANY($4::text[])
     RETURNING ${INCOME_LINE_TYPE_SELECT}`,
    [name, sortOrder, propertyId, matchNames.map((matchName) => matchName.toLowerCase())]
  );
  if (restored.rows.length > 0) {
    return mapPropertyIncomeLineTypeRow(restored.rows[0] as Record<string, unknown>);
  }

  const inserted = await db.query(
    `INSERT INTO property_income_line_types (property_id, name, sort_order, is_system)
     VALUES ($1, $2, $3, true)
     RETURNING ${INCOME_LINE_TYPE_SELECT}`,
    [propertyId, name, sortOrder]
  );
  return mapPropertyIncomeLineTypeRow(inserted.rows[0] as Record<string, unknown>);
}

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

  async ensureLeaseDepositIncomeLineType(
    propertyId: string,
    client?: PoolClient
  ): Promise<IPropertyIncomeLineType> {
    return ensureSystemIncomeLineType(
      propertyId,
      SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME,
      SYSTEM_SECURITY_DEPOSIT_SORT_ORDER,
      client
    );
  },

  async ensureLeaseRentIncomeLineType(
    propertyId: string,
    client?: PoolClient
  ): Promise<IPropertyIncomeLineType> {
    return ensureSystemIncomeLineType(
      propertyId,
      SYSTEM_LEASE_RENT_INCOME_TYPE_NAME,
      SYSTEM_LEASE_RENT_SORT_ORDER,
      client,
      [DEFAULT_RENT_TYPE_NAME]
    );
  },

  async ensureSystemIncomeLineTypes(
    propertyId: string,
    client?: PoolClient
  ): Promise<{
    deposit: IPropertyIncomeLineType;
    rent: IPropertyIncomeLineType;
  }> {
    const rent = await propertyIncomeLineTypesDb.ensureLeaseRentIncomeLineType(propertyId, client);
    const deposit = await propertyIncomeLineTypesDb.ensureLeaseDepositIncomeLineType(
      propertyId,
      client
    );
    return { deposit, rent };
  },

  async findByIdForProperty(
    typeId: string,
    propertyId: string,
    client?: PoolClient,
    activeOnly = false
  ): Promise<IPropertyIncomeLineType | null> {
    const db = client ?? pool;
    const result = await db.query(
      `SELECT ${INCOME_LINE_TYPE_SELECT}
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
      `SELECT ${INCOME_LINE_TYPE_SELECT}
       FROM property_income_line_types
       WHERE property_id = $1
         AND is_deleted = false
         AND is_system = false
       ORDER BY sort_order ASC, created_at ASC`,
      [propertyId]
    );
    return mapIncomeLineTypeRows(result.rows as Record<string, unknown>[]);
  },

  async replaceAll(
    propertyId: string,
    inputs: IPropertyIncomeLineTypeInput[],
    client?: PoolClient
  ): Promise<IPropertyIncomeLineType[]> {
    const db = client ?? pool;
    const systemTypes = await propertyIncomeLineTypesDb.ensureSystemIncomeLineTypes(
      propertyId,
      client
    );
    const incomingIds = [
      ...new Set([
        ...inputs.flatMap((input) => (input.id != null ? [input.id] : [])),
        systemTypes.rent.id,
        systemTypes.deposit.id,
      ]),
    ];

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
           WHERE id = $3
             AND property_id = $4
             AND is_system = false`,
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
            `INSERT INTO property_income_line_types (property_id, name, sort_order, is_system)
             VALUES ($1, $2, $3, false)`,
            [propertyId, name, input.sortOrder]
          );
        }
      }
    }

    return propertyIncomeLineTypesDb.findByProperty(propertyId, client);
  },

  async seedDefaults(propertyId: string, client?: PoolClient): Promise<void> {
    const db = client ?? pool;
    await propertyIncomeLineTypesDb.ensureSystemIncomeLineTypes(propertyId, client);

    const hasUserManagedRows = await db.query(
      `SELECT EXISTS(
         SELECT 1 FROM property_income_line_types
         WHERE property_id = $1 AND is_system = false
       ) AS exists`,
      [propertyId]
    );
    if (Boolean(hasUserManagedRows.rows[0]?.exists)) {
      return;
    }

    for (let index = 0; index < DEFAULT_PROPERTY_INCOME_LINE_TYPES.length; index += 1) {
      const incomeType = DEFAULT_PROPERTY_INCOME_LINE_TYPES[index];
      if (incomeType == null) continue;
      await db.query(
        `INSERT INTO property_income_line_types (property_id, name, sort_order, is_system)
         VALUES ($1, $2, $3, false)`,
        [propertyId, incomeType.name, index]
      );
    }
  },
};
