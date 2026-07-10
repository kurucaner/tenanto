import type {
  ICreatePropertyReservationBody,
  IPropertyReservation,
  IPropertyReservationComputedFields,
  IPropertyReservationsListQuery,
  IUpdatePropertyReservationBody,
} from "@/packages/shared";

import { mapPropertyReservationRow } from "./mappers";
import { pool } from "./pool";

interface IReservationListQueryParts {
  conditions: string[];
  joinUnits: string;
  paramIndex: number;
  values: unknown[];
}

function pushReservationCondition(
  parts: IReservationListQueryParts,
  condition: string,
  value: unknown
): void {
  parts.conditions.push(condition.replace("$?", `$${parts.paramIndex}`));
  parts.values.push(value);
  parts.paramIndex += 1;
}

function applyReservationDateFilters(
  filters: IPropertyReservationsListQuery,
  parts: IReservationListQueryParts
): void {
  const dateFilters: Array<[string | undefined, string]> = [
    [filters.from, "pr.check_in >= $?"],
    [filters.to, "pr.check_in <= $?"],
    [filters.checkOutFrom, "pr.check_out >= $?"],
    [filters.checkInTo, "pr.check_in <= $?"],
  ];
  for (const [value, condition] of dateFilters) {
    if (value) pushReservationCondition(parts, condition, value);
  }
}

function applyIncludeReservationIdFilter(
  filters: IPropertyReservationsListQuery,
  parts: IReservationListQueryParts
): void {
  if (!filters.includeReservationId) return;

  const pickerConditions = parts.conditions.slice(1);
  parts.conditions.length = 0;
  parts.conditions.push("pr.property_id = $1");
  if (pickerConditions.length > 0) {
    pushReservationCondition(
      parts,
      `(${pickerConditions.join(" AND ")} OR pr.id = $?)`,
      filters.includeReservationId
    );
    return;
  }
  pushReservationCondition(parts, "pr.id = $?", filters.includeReservationId);
}

function buildReservationListQuery(
  propertyId: string,
  filters: IPropertyReservationsListQuery,
  includeDeleted: boolean
): { joinUnits: string; limitClause: string; sqlConditions: string; values: unknown[] } {
  const parts: IReservationListQueryParts = {
    conditions: ["pr.property_id = $1"],
    joinUnits: "",
    paramIndex: 2,
    values: [propertyId],
  };

  applyReservationDateFilters(filters, parts);

  if (filters.unitId) {
    pushReservationCondition(parts, "pr.unit_id = $?", filters.unitId);
  }

  applyIncludeReservationIdFilter(filters, parts);

  if (filters.channel) {
    pushReservationCondition(
      parts,
      "pr.channel = $?::property_reservation_channel",
      filters.channel
    );
  }
  if (filters.status) {
    pushReservationCondition(parts, "pr.status = $?::property_reservation_status", filters.status);
  }
  if (filters.rentalType) {
    parts.joinUnits = "INNER JOIN property_units pu ON pu.id = pr.unit_id";
    pushReservationCondition(
      parts,
      "pu.rental_type = $?::property_unit_rental_type",
      filters.rentalType
    );
  }
  if (!includeDeleted) {
    parts.conditions.push("pr.is_deleted = false");
  }

  const limitClause =
    filters.limit != null && filters.limit > 0 ? ` LIMIT ${Math.floor(filters.limit)}` : "";

  return {
    joinUnits: parts.joinUnits,
    limitClause,
    sqlConditions: parts.conditions.join(" AND "),
    values: parts.values,
  };
}

export const propertyReservationsDb = {
  async create(
    propertyId: string,
    input: ICreatePropertyReservationBody,
    computed: IPropertyReservationComputedFields
  ): Promise<IPropertyReservation> {
    const result = await pool.query(
      `INSERT INTO property_reservations (
         property_id,
         unit_id,
         guest_name,
         reservation_number,
         check_in,
         check_out,
         nights,
         status,
         channel,
         room_total,
         cleaning_fee,
         gross_income,
         tax_breakdown,
         channel_commission,
         channel_commission_rate,
         net_income
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8::property_reservation_status,
         $9::property_reservation_channel,
         $10, $11, $12, $13::jsonb, $14, $15, $16
       )
       RETURNING *`,
      [
        propertyId,
        input.unitId,
        input.guestName.trim(),
        input.reservationNumber?.trim() || null,
        input.checkIn,
        input.checkOut,
        computed.nights,
        input.status,
        input.channel,
        input.roomTotal,
        input.cleaningFee,
        computed.grossIncome,
        JSON.stringify(computed.taxBreakdown),
        computed.channelCommission,
        computed.channelCommissionRate,
        computed.netIncome,
      ]
    );
    return mapPropertyReservationRow(result.rows[0] as Record<string, unknown>);
  },

  async findById(id: string): Promise<IPropertyReservation | null> {
    const result = await pool.query(`SELECT * FROM property_reservations WHERE id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return mapPropertyReservationRow(result.rows[0] as Record<string, unknown>);
  },

  async findByProperty(
    propertyId: string,
    filters: IPropertyReservationsListQuery = {},
    includeDeleted = false
  ): Promise<IPropertyReservation[]> {
    const { joinUnits, limitClause, sqlConditions, values } = buildReservationListQuery(
      propertyId,
      filters,
      includeDeleted
    );

    const result = await pool.query(
      `SELECT pr.*
       FROM property_reservations pr
       ${joinUnits}
       WHERE ${sqlConditions}
       ORDER BY pr.check_in DESC, pr.created_at DESC${limitClause}`,
      values
    );

    return result.rows.map((row) => mapPropertyReservationRow(row as Record<string, unknown>));
  },

  async restore(id: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE property_reservations SET is_deleted = false, deleted_at = NULL WHERE id = $1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  },

  async softDelete(id: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE property_reservations SET is_deleted = true, deleted_at = NOW() WHERE id = $1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  },

  async update(
    id: string,
    input: IUpdatePropertyReservationBody,
    computed: IPropertyReservationComputedFields
  ): Promise<IPropertyReservation | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (input.unitId !== undefined) {
      setClauses.push(`unit_id = $${p++}`);
      values.push(input.unitId);
    }
    if (input.guestName !== undefined) {
      setClauses.push(`guest_name = $${p++}`);
      values.push(input.guestName.trim());
    }
    if (input.reservationNumber !== undefined) {
      setClauses.push(`reservation_number = $${p++}`);
      values.push(input.reservationNumber?.trim() || null);
    }
    if (input.checkIn !== undefined) {
      setClauses.push(`check_in = $${p++}`);
      values.push(input.checkIn);
    }
    if (input.checkOut !== undefined) {
      setClauses.push(`check_out = $${p++}`);
      values.push(input.checkOut);
    }
    if (input.status !== undefined) {
      setClauses.push(`status = $${p++}::property_reservation_status`);
      values.push(input.status);
    }
    if (input.channel !== undefined) {
      setClauses.push(`channel = $${p++}::property_reservation_channel`);
      values.push(input.channel);
    }
    if (input.roomTotal !== undefined) {
      setClauses.push(`room_total = $${p++}`);
      values.push(input.roomTotal);
    }
    if (input.cleaningFee !== undefined) {
      setClauses.push(`cleaning_fee = $${p++}`);
      values.push(input.cleaningFee);
    }

    setClauses.push(`nights = $${p++}`);
    values.push(computed.nights);
    setClauses.push(`gross_income = $${p++}`);
    values.push(computed.grossIncome);
    setClauses.push(`tax_breakdown = $${p++}::jsonb`);
    values.push(JSON.stringify(computed.taxBreakdown));
    setClauses.push(`channel_commission = $${p++}`);
    values.push(computed.channelCommission);
    setClauses.push(`channel_commission_rate = $${p++}`);
    values.push(computed.channelCommissionRate);
    setClauses.push(`net_income = $${p++}`);
    values.push(computed.netIncome);

    values.push(id);
    const result = await pool.query(
      `UPDATE property_reservations SET ${setClauses.join(", ")} WHERE id = $${p} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return null;
    return mapPropertyReservationRow(result.rows[0] as Record<string, unknown>);
  },
};
