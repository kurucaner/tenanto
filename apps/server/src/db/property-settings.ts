import {
  DEFAULT_PROPERTY_SETTINGS,
  type IPropertySettings,
  type IUpdatePropertySettingsBody,
} from "@/packages/shared";

import { mapPropertySettingsRow } from "./mappers";
import { pool } from "./pool";

const BODY_TO_COLUMN: Record<keyof IUpdatePropertySettingsBody, string> = {
  airbnbCommissionRate: "airbnb_commission_rate",
  bookingCommissionRate: "booking_commission_rate",
  conventionDevelopmentTaxRate: "convention_development_tax_rate",
  directCommissionRate: "direct_commission_rate",
  expediaCommissionRate: "expedia_commission_rate",
  miamiDadeSurtaxRate: "miami_dade_surtax_rate",
  resortTaxRate: "resort_tax_rate",
  salesTaxRate: "sales_tax_rate",
};

export const propertySettingsDb = {
  async findByProperty(propertyId: string): Promise<IPropertySettings | null> {
    const result = await pool.query(`SELECT * FROM property_settings WHERE property_id = $1`, [
      propertyId,
    ]);
    if (result.rows.length === 0) return null;
    return mapPropertySettingsRow(result.rows[0] as Record<string, unknown>);
  },

  async getOrCreateDefaults(propertyId: string): Promise<IPropertySettings> {
    await pool.query(
      `INSERT INTO property_settings (
         property_id,
         sales_tax_rate,
         miami_dade_surtax_rate,
         convention_development_tax_rate,
         resort_tax_rate,
         airbnb_commission_rate,
         booking_commission_rate,
         expedia_commission_rate,
         direct_commission_rate
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (property_id) DO NOTHING`,
      [
        propertyId,
        DEFAULT_PROPERTY_SETTINGS.salesTaxRate,
        DEFAULT_PROPERTY_SETTINGS.miamiDadeSurtaxRate,
        DEFAULT_PROPERTY_SETTINGS.conventionDevelopmentTaxRate,
        DEFAULT_PROPERTY_SETTINGS.resortTaxRate,
        DEFAULT_PROPERTY_SETTINGS.airbnbCommissionRate,
        DEFAULT_PROPERTY_SETTINGS.bookingCommissionRate,
        DEFAULT_PROPERTY_SETTINGS.expediaCommissionRate,
        DEFAULT_PROPERTY_SETTINGS.directCommissionRate,
      ]
    );

    const settings = await propertySettingsDb.findByProperty(propertyId);
    if (!settings) {
      throw new Error(`Failed to load property settings for property ${propertyId}`);
    }
    return settings;
  },

  async update(
    propertyId: string,
    input: IUpdatePropertySettingsBody
  ): Promise<IPropertySettings | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    for (const key of Object.keys(input) as (keyof IUpdatePropertySettingsBody)[]) {
      const value = input[key];
      if (value === undefined) continue;
      const column = BODY_TO_COLUMN[key];
      setClauses.push(`${column} = $${p++}`);
      values.push(value);
    }

    if (setClauses.length === 0) return propertySettingsDb.findByProperty(propertyId);

    values.push(propertyId);
    const result = await pool.query(
      `UPDATE property_settings SET ${setClauses.join(", ")} WHERE property_id = $${p} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return null;
    return mapPropertySettingsRow(result.rows[0] as Record<string, unknown>);
  },
};
