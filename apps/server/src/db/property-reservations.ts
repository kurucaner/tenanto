import type {
  ICreatePropertyReservationBody,
  IPropertyReservation,
  IPropertyReservationComputedFields,
  IPropertyReservationsListQuery,
  IUpdatePropertyReservationBody,
} from "@/packages/shared";

import { mapPropertyReservationRow } from "./mappers";
import { pool } from "./pool";

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
         room_rate,
         cleaning_fee,
         gross_income,
         sales_tax,
         miami_dade_surtax,
         convention_development_tax,
         resort_tax,
         channel_commission,
         net_income
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8::property_reservation_status,
         $9::property_reservation_channel,
         $10, $11, $12, $13, $14, $15, $16, $17, $18
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
        input.roomRate,
        input.cleaningFee,
        computed.grossIncome,
        computed.salesTax,
        computed.miamiDadeSurtax,
        computed.conventionDevelopmentTax,
        computed.resortTax,
        computed.channelCommission,
        computed.netIncome,
      ]
    );
    return mapPropertyReservationRow(result.rows[0] as Record<string, unknown>);
  },

  async delete(id: string): Promise<boolean> {
    const result = await pool.query(`DELETE FROM property_reservations WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  },

  async findById(id: string): Promise<IPropertyReservation | null> {
    const result = await pool.query(`SELECT * FROM property_reservations WHERE id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return mapPropertyReservationRow(result.rows[0] as Record<string, unknown>);
  },

  async findByProperty(
    propertyId: string,
    filters: IPropertyReservationsListQuery = {}
  ): Promise<IPropertyReservation[]> {
    const conditions = ["pr.property_id = $1"];
    const values: unknown[] = [propertyId];
    let p = 2;

    if (filters.from) {
      conditions.push(`pr.check_in >= $${p++}`);
      values.push(filters.from);
    }
    if (filters.to) {
      conditions.push(`pr.check_in <= $${p++}`);
      values.push(filters.to);
    }
    if (filters.unitId) {
      conditions.push(`pr.unit_id = $${p++}`);
      values.push(filters.unitId);
    }
    if (filters.channel) {
      conditions.push(`pr.channel = $${p++}::property_reservation_channel`);
      values.push(filters.channel);
    }
    if (filters.status) {
      conditions.push(`pr.status = $${p++}::property_reservation_status`);
      values.push(filters.status);
    }

    const joinUnits = filters.rentalType ? "INNER JOIN property_units pu ON pu.id = pr.unit_id" : "";
    if (filters.rentalType) {
      conditions.push(`pu.rental_type = $${p++}::property_unit_rental_type`);
      values.push(filters.rentalType);
    }

    const result = await pool.query(
      `SELECT pr.*
       FROM property_reservations pr
       ${joinUnits}
       WHERE ${conditions.join(" AND ")}
       ORDER BY pr.check_in DESC, pr.created_at DESC`,
      values
    );

    return result.rows.map((row) =>
      mapPropertyReservationRow(row as Record<string, unknown>)
    );
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
    if (input.roomRate !== undefined) {
      setClauses.push(`room_rate = $${p++}`);
      values.push(input.roomRate);
    }
    if (input.cleaningFee !== undefined) {
      setClauses.push(`cleaning_fee = $${p++}`);
      values.push(input.cleaningFee);
    }

    setClauses.push(`nights = $${p++}`);
    values.push(computed.nights);
    setClauses.push(`gross_income = $${p++}`);
    values.push(computed.grossIncome);
    setClauses.push(`sales_tax = $${p++}`);
    values.push(computed.salesTax);
    setClauses.push(`miami_dade_surtax = $${p++}`);
    values.push(computed.miamiDadeSurtax);
    setClauses.push(`convention_development_tax = $${p++}`);
    values.push(computed.conventionDevelopmentTax);
    setClauses.push(`resort_tax = $${p++}`);
    values.push(computed.resortTax);
    setClauses.push(`channel_commission = $${p++}`);
    values.push(computed.channelCommission);
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
