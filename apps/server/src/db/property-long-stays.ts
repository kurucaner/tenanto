import type { ICreatePropertyLongStayBody, IPropertyLongStay } from "@/packages/shared";

import { mapPropertyLongStayRow } from "./mappers";
import { pool } from "./pool";

export const propertyLongStaysDb = {
  async create(propertyId: string, input: ICreatePropertyLongStayBody): Promise<IPropertyLongStay> {
    const result = await pool.query(
      `INSERT INTO property_long_stays
         (property_id, unit_id, guest_name, lease_start_date, term_months, monthly_rent)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        propertyId,
        input.unitId,
        input.guestName.trim(),
        input.leaseStartDate,
        input.termMonths,
        input.monthlyRent,
      ]
    );
    return mapPropertyLongStayRow(result.rows[0] as Record<string, unknown>);
  },
};
