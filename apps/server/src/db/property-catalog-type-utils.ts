import type { Pool, PoolClient } from "pg";

type TPropertyCatalogTypeTable = "property_expense_category_types" | "property_income_line_types";

type TDbClient = Pool | PoolClient;

export async function propertyCatalogHasAnyRows(
  db: TDbClient,
  table: TPropertyCatalogTypeTable,
  propertyId: string
): Promise<boolean> {
  const result = await db.query(
    `SELECT EXISTS(
       SELECT 1 FROM ${table} WHERE property_id = $1
     ) AS exists`,
    [propertyId]
  );
  return Boolean(result.rows[0]?.exists);
}

export async function archivePropertyCatalogTypesNotInIds(
  db: TDbClient,
  table: TPropertyCatalogTypeTable,
  propertyId: string,
  incomingIds: string[]
): Promise<void> {
  const systemGuard = table === "property_income_line_types" ? " AND is_system = false" : "";

  if (incomingIds.length === 0) {
    await db.query(
      `UPDATE ${table}
       SET is_deleted = true, deleted_at = NOW(), updated_at = NOW()
       WHERE property_id = $1 AND is_deleted = false${systemGuard}`,
      [propertyId]
    );
    return;
  }

  await db.query(
    `UPDATE ${table}
     SET is_deleted = true, deleted_at = NOW(), updated_at = NOW()
     WHERE property_id = $1
       AND is_deleted = false
       ${systemGuard}
       AND NOT (id = ANY($2::uuid[]))`,
    [propertyId, incomingIds]
  );
}

export async function restoreArchivedIncomeLineTypeByName(
  db: TDbClient,
  propertyId: string,
  name: string,
  sortOrder: number
): Promise<boolean> {
  const result = await db.query(
    `UPDATE property_income_line_types
     SET name = $1,
         sort_order = $2,
         is_deleted = false,
         deleted_at = NULL,
         updated_at = NOW()
     WHERE property_id = $3
       AND is_deleted = true
       AND lower(name) = lower($1)
     RETURNING id`,
    [name, sortOrder, propertyId]
  );
  return result.rows.length > 0;
}

export async function restoreArchivedExpenseCategoryTypeByName(
  db: TDbClient,
  propertyId: string,
  name: string,
  sortOrder: number,
  isAnnualAmount: boolean
): Promise<boolean> {
  const result = await db.query(
    `UPDATE property_expense_category_types
     SET name = $1,
         sort_order = $2,
         is_annual_amount = $3,
         is_deleted = false,
         deleted_at = NULL,
         updated_at = NOW()
     WHERE property_id = $4
       AND is_deleted = true
       AND lower(name) = lower($1)
     RETURNING id`,
    [name, sortOrder, isAnnualAmount, propertyId]
  );
  return result.rows.length > 0;
}
