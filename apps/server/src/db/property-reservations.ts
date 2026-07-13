import type {
  ICreatePropertyReservationBody,
  IPropertyReservation,
  IPropertyReservationComputedFields,
  IPropertyReservationsListQuery,
  IUpdatePropertyReservationBody,
} from "@/packages/shared";

import { mapPropertyReservationRow } from "./mappers";
import { pool } from "./pool";

const RESERVATION_SELECT = `
  pr.*,
  pcc.name AS channel_name,
  pcc.exclude_cleaning_from_commission_base,
  pcc.exclude_resort_tax_from_payout
`;

const RESERVATION_CHANNEL_JOIN = `
  INNER JOIN property_channel_commissions pcc ON pcc.id = pr.channel_commission_id
`;

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

  if (filters.channelCommissionId) {
    pushReservationCondition(parts, "pr.channel_commission_id = $?", filters.channelCommissionId);
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
      `WITH inserted AS (
         INSERT INTO property_reservations (
           property_id,
           unit_id,
           guest_name,
           reservation_number,
           check_in,
           check_out,
           nights,
           status,
           channel_commission_id,
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
           $9,
           $10, $11, $12, $13::jsonb, $14, $15, $16
         )
         RETURNING *
       )
       SELECT ${RESERVATION_SELECT}
       FROM inserted pr
       ${RESERVATION_CHANNEL_JOIN}`,
      [
        propertyId,
        input.unitId,
        input.guestName.trim(),
        input.reservationNumber?.trim() || null,
        input.checkIn,
        input.checkOut,
        computed.nights,
        input.status,
        input.channelCommissionId,
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

  async createMany(
    propertyId: string,
    inputs: Array<{
      computed: IPropertyReservationComputedFields;
      input: ICreatePropertyReservationBody;
      refunded: boolean;
    }>,
    refundedByUserId: string
  ): Promise<IPropertyReservation[]> {
    if (inputs.length === 0) {
      return [];
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const reservations: IPropertyReservation[] = [];

      for (const entry of inputs) {
        const insertResult = await client.query(
          `WITH inserted AS (
             INSERT INTO property_reservations (
               property_id,
               unit_id,
               guest_name,
               reservation_number,
               check_in,
               check_out,
               nights,
               status,
               channel_commission_id,
               room_total,
               cleaning_fee,
               gross_income,
               tax_breakdown,
               channel_commission,
               channel_commission_rate,
               net_income,
               refunded_at,
               refunded_by
             ) VALUES (
               $1, $2, $3, $4, $5, $6, $7,
               $8::property_reservation_status,
               $9,
               $10, $11, $12, $13::jsonb, $14, $15, $16,
               CASE WHEN $17::boolean THEN NOW() ELSE NULL END,
               CASE WHEN $17::boolean THEN $18::uuid ELSE NULL END
             )
             RETURNING id
           )
           SELECT ${RESERVATION_SELECT}
           FROM inserted pr
           ${RESERVATION_CHANNEL_JOIN}`,
          [
            propertyId,
            entry.input.unitId,
            entry.input.guestName.trim(),
            entry.input.reservationNumber?.trim() || null,
            entry.input.checkIn,
            entry.input.checkOut,
            entry.computed.nights,
            entry.input.status,
            entry.input.channelCommissionId,
            entry.input.roomTotal,
            entry.input.cleaningFee,
            entry.computed.grossIncome,
            JSON.stringify(entry.computed.taxBreakdown),
            entry.computed.channelCommission,
            entry.computed.channelCommissionRate,
            entry.computed.netIncome,
            entry.refunded,
            refundedByUserId,
          ]
        );
        reservations.push(
          mapPropertyReservationRow(insertResult.rows[0] as Record<string, unknown>)
        );
      }

      await client.query("COMMIT");
      return reservations;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async findById(id: string): Promise<IPropertyReservation | null> {
    const result = await pool.query(
      `SELECT ${RESERVATION_SELECT}
       FROM property_reservations pr
       ${RESERVATION_CHANNEL_JOIN}
       WHERE pr.id = $1`,
      [id]
    );
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
      `SELECT ${RESERVATION_SELECT}
       FROM property_reservations pr
       ${RESERVATION_CHANNEL_JOIN}
       ${joinUnits}
       WHERE ${sqlConditions}
       ORDER BY pr.check_in DESC, pr.created_at DESC${limitClause}`,
      values
    );

    return result.rows.map((row) => mapPropertyReservationRow(row as Record<string, unknown>));
  },

  async refund(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE property_reservations
       SET refunded_at = NOW(), refunded_by = $2
       WHERE id = $1 AND refunded_at IS NULL`,
      [id, userId]
    );
    return (result.rowCount ?? 0) > 0;
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

  async unrefund(id: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE property_reservations
       SET refunded_at = NULL, refunded_by = NULL
       WHERE id = $1 AND refunded_at IS NOT NULL`,
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
    if (input.channelCommissionId !== undefined) {
      setClauses.push(`channel_commission_id = $${p++}`);
      values.push(input.channelCommissionId);
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
      `WITH updated AS (
         UPDATE property_reservations SET ${setClauses.join(", ")} WHERE id = $${p} RETURNING *
       )
       SELECT ${RESERVATION_SELECT}
       FROM updated pr
       ${RESERVATION_CHANNEL_JOIN}`,
      values
    );
    if (result.rows.length === 0) return null;
    return mapPropertyReservationRow(result.rows[0] as Record<string, unknown>);
  },
};
