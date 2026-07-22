import { type IPropertySettings, type IUpdatePropertySettingsBody } from "@/packages/shared";

import { mapPropertySettingsRow } from "./mappers";
import { pool } from "./pool";
import { propertyChannelCommissionsDb } from "./property-channel-commissions";
import { propertyExpenseCategoryTypesDb } from "./property-expense-category-types";
import { propertyIncomeLineTypesDb } from "./property-income-line-types";
import { propertyTaxRatesDb } from "./property-tax-rates";

async function mergeSettingsWithRelated(row: Record<string, unknown>): Promise<IPropertySettings> {
  const base = mapPropertySettingsRow(row);
  const [taxRates, incomeLineTypes, expenseCategoryTypes, channelCommissions] = await Promise.all([
    propertyTaxRatesDb.findByProperty(base.propertyId),
    propertyIncomeLineTypesDb.findByProperty(base.propertyId),
    propertyExpenseCategoryTypesDb.findByProperty(base.propertyId),
    propertyChannelCommissionsDb.findByProperty(base.propertyId),
  ]);
  return { ...base, channelCommissions, expenseCategoryTypes, incomeLineTypes, taxRates };
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
      `INSERT INTO property_settings (property_id) VALUES ($1) ON CONFLICT (property_id) DO NOTHING`,
      [propertyId]
    );

    await Promise.all([
      propertyTaxRatesDb.seedDefaults(propertyId),
      propertyIncomeLineTypesDb.seedDefaults(propertyId),
      propertyExpenseCategoryTypesDb.seedDefaults(propertyId),
      propertyChannelCommissionsDb.seedDefaults(propertyId),
    ]);

    await propertyIncomeLineTypesDb.ensureSystemIncomeLineTypes(propertyId);

    const settings = await propertySettingsDb.findByProperty(propertyId);
    if (!settings) {
      throw new Error(`Failed to load property settings for property ${propertyId}`);
    }
    return settings;
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

      if (input.expenseCategoryTypes != null) {
        await propertyExpenseCategoryTypesDb.replaceAll(
          propertyId,
          input.expenseCategoryTypes,
          client
        );
      }

      if (input.channelCommissions != null) {
        await propertyChannelCommissionsDb.replaceAll(propertyId, input.channelCommissions, client);
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
