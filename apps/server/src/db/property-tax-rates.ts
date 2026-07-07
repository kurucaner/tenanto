import type { PoolClient } from "pg";

import {
  DEFAULT_PROPERTY_TAX_RATES,
  type IPropertyTaxRate,
  type IPropertyTaxRateInput,
} from "@/packages/shared";

import { mapPropertyTaxRateRow } from "./mappers";
import { pool } from "./pool";

export const propertyTaxRatesDb = {
  async findByProperty(propertyId: string, client?: PoolClient): Promise<IPropertyTaxRate[]> {
    const db = client ?? pool;
    const result = await db.query(
      `SELECT id, property_id, name, rate, sort_order
       FROM property_tax_rates
       WHERE property_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [propertyId]
    );
    return result.rows.map((row) =>
      mapPropertyTaxRateRow(row as Record<string, unknown>)
    );
  },

  async replaceAll(
    propertyId: string,
    inputs: IPropertyTaxRateInput[],
    client?: PoolClient
  ): Promise<IPropertyTaxRate[]> {
    const db = client ?? pool;
    const incomingIds = inputs.flatMap((input) => (input.id != null ? [input.id] : []));

    if (incomingIds.length === 0) {
      await db.query(`DELETE FROM property_tax_rates WHERE property_id = $1`, [propertyId]);
    } else {
      await db.query(
        `DELETE FROM property_tax_rates
         WHERE property_id = $1
           AND NOT (id = ANY($2::uuid[]))`,
        [propertyId, incomingIds]
      );
    }

    for (const input of inputs) {
      const name = input.name.trim();
      if (input.id != null) {
        await db.query(
          `UPDATE property_tax_rates
           SET name = $1, rate = $2, sort_order = $3
           WHERE id = $4 AND property_id = $5`,
          [name, input.rate, input.sortOrder, input.id, propertyId]
        );
      } else {
        await db.query(
          `INSERT INTO property_tax_rates (property_id, name, rate, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [propertyId, name, input.rate, input.sortOrder]
        );
      }
    }

    return propertyTaxRatesDb.findByProperty(propertyId, client);
  },

  async seedDefaults(propertyId: string, client?: PoolClient): Promise<void> {
    const existing = await propertyTaxRatesDb.findByProperty(propertyId, client);
    if (existing.length > 0) return;

    const db = client ?? pool;
    for (let index = 0; index < DEFAULT_PROPERTY_TAX_RATES.length; index += 1) {
      const tax = DEFAULT_PROPERTY_TAX_RATES[index];
      if (tax == null) continue;
      await db.query(
        `INSERT INTO property_tax_rates (property_id, name, rate, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [propertyId, tax.name, tax.rate, index]
      );
    }
  },
};
