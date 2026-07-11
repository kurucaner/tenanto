import type { PoolClient } from "pg";

import {
  DEFAULT_PROPERTY_CHANNEL_COMMISSIONS,
  type IPropertyChannelCommission,
  type IPropertyChannelCommissionInput,
} from "@/packages/shared";

import { mapPropertyChannelCommissionRow } from "./mappers";
import { pool } from "./pool";

export const propertyChannelCommissionsDb = {
  async countUsage(channelCommissionId: string, client?: PoolClient): Promise<number> {
    const db = client ?? pool;
    const result = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM property_reservations
       WHERE channel_commission_id = $1 AND is_deleted = false`,
      [channelCommissionId]
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  async findByIdForProperty(
    channelCommissionId: string,
    propertyId: string,
    client?: PoolClient
  ): Promise<IPropertyChannelCommission | null> {
    const db = client ?? pool;
    const result = await db.query(
      `SELECT id, property_id, name, rate, sort_order,
              exclude_cleaning_from_commission_base, exclude_resort_tax_from_payout
       FROM property_channel_commissions
       WHERE id = $1 AND property_id = $2`,
      [channelCommissionId, propertyId]
    );
    if (result.rows.length === 0) return null;
    return mapPropertyChannelCommissionRow(result.rows[0] as Record<string, unknown>);
  },

  async findByProperty(
    propertyId: string,
    client?: PoolClient
  ): Promise<IPropertyChannelCommission[]> {
    const db = client ?? pool;
    const result = await db.query(
      `SELECT id, property_id, name, rate, sort_order,
              exclude_cleaning_from_commission_base, exclude_resort_tax_from_payout
       FROM property_channel_commissions
       WHERE property_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [propertyId]
    );
    return result.rows.map((row) =>
      mapPropertyChannelCommissionRow(row as Record<string, unknown>)
    );
  },

  async replaceAll(
    propertyId: string,
    inputs: IPropertyChannelCommissionInput[],
    client?: PoolClient
  ): Promise<IPropertyChannelCommission[]> {
    const db = client ?? pool;
    const incomingIds = inputs.flatMap((input) => (input.id != null ? [input.id] : []));

    if (incomingIds.length === 0) {
      await db.query(`DELETE FROM property_channel_commissions WHERE property_id = $1`, [
        propertyId,
      ]);
    } else {
      await db.query(
        `DELETE FROM property_channel_commissions
         WHERE property_id = $1
           AND NOT (id = ANY($2::uuid[]))`,
        [propertyId, incomingIds]
      );
    }

    for (const input of inputs) {
      const name = input.name.trim();
      const excludeCleaningFromCommissionBase = input.excludeCleaningFromCommissionBase === true;
      const excludeResortTaxFromPayout = input.excludeResortTaxFromPayout === true;
      if (input.id != null) {
        await db.query(
          `UPDATE property_channel_commissions
           SET name = $1,
               rate = $2,
               sort_order = $3,
               exclude_cleaning_from_commission_base = $4,
               exclude_resort_tax_from_payout = $5,
               updated_at = NOW()
           WHERE id = $6 AND property_id = $7`,
          [
            name,
            input.rate,
            input.sortOrder,
            excludeCleaningFromCommissionBase,
            excludeResortTaxFromPayout,
            input.id,
            propertyId,
          ]
        );
      } else {
        await db.query(
          `INSERT INTO property_channel_commissions (
             property_id,
             name,
             rate,
             sort_order,
             exclude_cleaning_from_commission_base,
             exclude_resort_tax_from_payout
           ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            propertyId,
            name,
            input.rate,
            input.sortOrder,
            excludeCleaningFromCommissionBase,
            excludeResortTaxFromPayout,
          ]
        );
      }
    }

    return propertyChannelCommissionsDb.findByProperty(propertyId, client);
  },

  async seedDefaults(propertyId: string, client?: PoolClient): Promise<void> {
    const existing = await propertyChannelCommissionsDb.findByProperty(propertyId, client);
    if (existing.length > 0) return;

    const db = client ?? pool;
    for (let index = 0; index < DEFAULT_PROPERTY_CHANNEL_COMMISSIONS.length; index += 1) {
      const channel = DEFAULT_PROPERTY_CHANNEL_COMMISSIONS[index];
      if (channel == null) continue;
      await db.query(
        `INSERT INTO property_channel_commissions (
           property_id,
           name,
           rate,
           sort_order,
           exclude_cleaning_from_commission_base,
           exclude_resort_tax_from_payout
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          propertyId,
          channel.name,
          channel.rate,
          index,
          channel.excludeCleaningFromCommissionBase ?? false,
          channel.excludeResortTaxFromPayout ?? false,
        ]
      );
    }
  },
};
