import {
  DEFAULT_PROPERTY_SETTINGS,
  type IPropertySettings,
  type IUpdatePropertySettingsBody,
} from "@/packages/shared";

import { mapPropertySettingsRow } from "./mappers";
import { pool } from "./pool";
import { propertyIncomeLineTypesDb } from "./property-income-line-types";
import { propertyTaxRatesDb } from "./property-tax-rates";

const BODY_TO_COLUMN: Record<
  Exclude<keyof IUpdatePropertySettingsBody, "incomeLineTypes" | "taxRates">,
  string
> = {
  airbnbCommissionRate: "airbnb_commission_rate",
  bookingCommissionRate: "booking_commission_rate",
  directCommissionRate: "direct_commission_rate",
  expediaCommissionRate: "expedia_commission_rate",
};

async function mergeSettingsWithRelated(row: Record<string, unknown>): Promise<IPropertySettings> {
  const base = mapPropertySettingsRow(row);
  const [taxRates, incomeLineTypes] = await Promise.all([
    propertyTaxRatesDb.findByProperty(base.propertyId),
    propertyIncomeLineTypesDb.findByProperty(base.propertyId),
  ]);
  return { ...base, incomeLineTypes, taxRates };
}

export const propertySettingsDb = {
  async findByProperty(propertyId: string): Promise<IPropertySettings | null> {
    const result = await pool.query(`SELECT * FROM property_settings WHERE property_id = $1`, [
      propertyId,
    ]);
    if (result.rows.length === 0) return null;
    return mergeSettingsWithRelated(result.rows[0] as Record<string, unknown>);
  },

  async getOrCreateDefaults(propertyId: string): Promise<IPropertySettings> {
    await pool.query(
      `INSERT INTO property_settings (
         property_id,
         airbnb_commission_rate,
         booking_commission_rate,
         expedia_commission_rate,
         direct_commission_rate
       ) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (property_id) DO NOTHING`,
      [
        propertyId,
        DEFAULT_PROPERTY_SETTINGS.airbnbCommissionRate,
        DEFAULT_PROPERTY_SETTINGS.bookingCommissionRate,
        DEFAULT_PROPERTY_SETTINGS.expediaCommissionRate,
        DEFAULT_PROPERTY_SETTINGS.directCommissionRate,
      ]
    );

    await Promise.all([
      propertyTaxRatesDb.seedDefaults(propertyId),
      propertyIncomeLineTypesDb.seedDefaults(propertyId),
    ]);

    const settings = await propertySettingsDb.findByProperty(propertyId);
    if (!settings) {
      throw new Error(`Failed to load property settings for property ${propertyId}`);
    }
    return settings;
  },

  async updateCommissions(
    propertyId: string,
    input: IUpdatePropertySettingsBody
  ): Promise<IPropertySettings | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    for (const key of Object.keys(BODY_TO_COLUMN) as Array<
      Exclude<keyof IUpdatePropertySettingsBody, "incomeLineTypes" | "taxRates">
    >) {
      const value = input[key];
      if (value === undefined) continue;
      const column = BODY_TO_COLUMN[key];
      setClauses.push(`${column} = $${p++}`);
      values.push(value);
    }

    if (setClauses.length === 0) {
      return propertySettingsDb.findByProperty(propertyId);
    }

    values.push(propertyId);
    const result = await pool.query(
      `UPDATE property_settings SET ${setClauses.join(", ")} WHERE property_id = $${p} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return null;
    return mergeSettingsWithRelated(result.rows[0] as Record<string, unknown>);
  },

  async updateWithTaxRates(
    propertyId: string,
    input: IUpdatePropertySettingsBody
  ): Promise<IPropertySettings | null> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (input.taxRates != null) {
        await propertyTaxRatesDb.replaceAll(propertyId, input.taxRates, client);
      }

      if (input.incomeLineTypes != null) {
        await propertyIncomeLineTypesDb.replaceAll(propertyId, input.incomeLineTypes, client);
      }

      const setClauses: string[] = [];
      const values: unknown[] = [];
      let p = 1;

      for (const key of Object.keys(BODY_TO_COLUMN) as Array<
        Exclude<keyof IUpdatePropertySettingsBody, "incomeLineTypes" | "taxRates">
      >) {
        const value = input[key];
        if (value === undefined) continue;
        const column = BODY_TO_COLUMN[key];
        setClauses.push(`${column} = $${p++}`);
        values.push(value);
      }

      if (setClauses.length > 0) {
        values.push(propertyId);
        const result = await client.query(
          `UPDATE property_settings SET ${setClauses.join(", ")} WHERE property_id = $${p} RETURNING *`,
          values
        );
        if (result.rows.length === 0) {
          await client.query("ROLLBACK");
          return null;
        }
      }

      await client.query("COMMIT");
      return propertySettingsDb.findByProperty(propertyId);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};
