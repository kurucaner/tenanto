import { mapPropertyIncomeLineRow } from "@/db/mappers";
import { pool } from "@/db/pool";
import {
  buildLeaseDepositSummary,
  type ILeaseDepositSummary,
  type IPropertyIncomeLine,
  type IPropertyLongStay,
  sqlIsSecurityDepositIncomeLineType,
} from "@/packages/shared";

async function listDepositIncomeLinesForLongStay(
  propertyId: string,
  longStayId: string
): Promise<IPropertyIncomeLine[]> {
  const result = await pool.query(
    `SELECT
       pil.*,
       ilt.name AS income_line_type_name
     FROM property_income_lines pil
     INNER JOIN property_income_line_types ilt ON ilt.id = pil.income_line_type_id
     WHERE pil.property_id = $1
       AND pil.long_stay_id = $2
       AND pil.is_deleted = false
       AND ${sqlIsSecurityDepositIncomeLineType("ilt.name")}
     ORDER BY pil.transaction_date ASC, pil.created_at ASC`,
    [propertyId, longStayId]
  );

  return result.rows.map((row) => mapPropertyIncomeLineRow(row as Record<string, unknown>));
}

/** Loads deposit-typed income lines for a lease and builds the balance summary. */
export async function loadLeaseDepositSummary(
  lease: Pick<IPropertyLongStay, "id" | "propertyId" | "securityDepositAmount">
): Promise<ILeaseDepositSummary> {
  const lines = await listDepositIncomeLinesForLongStay(lease.propertyId, lease.id);
  return buildLeaseDepositSummary({
    expected: lease.securityDepositAmount,
    lines,
  });
}
