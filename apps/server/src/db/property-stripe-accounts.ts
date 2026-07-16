import type { IPropertyStripeConnectStatusResponse } from "@/packages/shared";

import { pool } from "./pool";

export interface IPropertyStripeAccount {
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingComplete: boolean;
  payoutsEnabled: boolean;
  propertyId: string;
  stripeAccountId: string;
  updatedAt: string;
}

function mapRow(row: Record<string, unknown>): IPropertyStripeAccount {
  return {
    chargesEnabled: row.charges_enabled as boolean,
    detailsSubmitted: row.details_submitted as boolean,
    onboardingComplete: row.onboarding_complete as boolean,
    payoutsEnabled: row.payouts_enabled as boolean,
    propertyId: row.property_id as string,
    stripeAccountId: row.stripe_account_id as string,
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export function toConnectStatusResponse(
  account: IPropertyStripeAccount | null
): IPropertyStripeConnectStatusResponse {
  if (!account) {
    return {
      chargesEnabled: false,
      detailsSubmitted: false,
      onboardingComplete: false,
      payoutsEnabled: false,
      stripeAccountId: null,
    };
  }
  return {
    chargesEnabled: account.chargesEnabled,
    detailsSubmitted: account.detailsSubmitted,
    onboardingComplete: account.onboardingComplete,
    payoutsEnabled: account.payoutsEnabled,
    stripeAccountId: account.stripeAccountId,
  };
}

export const propertyStripeAccountsDb = {
  async findByPropertyId(propertyId: string): Promise<IPropertyStripeAccount | null> {
    const result = await pool.query(
      `SELECT * FROM property_stripe_accounts WHERE property_id = $1`,
      [propertyId]
    );
    if (result.rows.length === 0) return null;
    return mapRow(result.rows[0] as Record<string, unknown>);
  },

  async findByStripeAccountId(stripeAccountId: string): Promise<IPropertyStripeAccount | null> {
    const result = await pool.query(
      `SELECT * FROM property_stripe_accounts WHERE stripe_account_id = $1`,
      [stripeAccountId]
    );
    if (result.rows.length === 0) return null;
    return mapRow(result.rows[0] as Record<string, unknown>);
  },

  async updateFlags(
    propertyId: string,
    flags: {
      chargesEnabled: boolean;
      detailsSubmitted: boolean;
      onboardingComplete: boolean;
      payoutsEnabled: boolean;
    }
  ): Promise<IPropertyStripeAccount | null> {
    const result = await pool.query(
      `UPDATE property_stripe_accounts SET
         charges_enabled = $2,
         payouts_enabled = $3,
         onboarding_complete = $4,
         details_submitted = $5,
         updated_at = CURRENT_TIMESTAMP
       WHERE property_id = $1
       RETURNING *`,
      [
        propertyId,
        flags.chargesEnabled,
        flags.payoutsEnabled,
        flags.onboardingComplete,
        flags.detailsSubmitted,
      ]
    );
    if (result.rows.length === 0) return null;
    return mapRow(result.rows[0] as Record<string, unknown>);
  },

  async upsert(input: {
    chargesEnabled: boolean;
    detailsSubmitted: boolean;
    onboardingComplete: boolean;
    payoutsEnabled: boolean;
    propertyId: string;
    stripeAccountId: string;
  }): Promise<IPropertyStripeAccount> {
    const result = await pool.query(
      `INSERT INTO property_stripe_accounts (
         property_id,
         stripe_account_id,
         charges_enabled,
         payouts_enabled,
         onboarding_complete,
         details_submitted
       ) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (property_id) DO UPDATE SET
         stripe_account_id = EXCLUDED.stripe_account_id,
         charges_enabled = EXCLUDED.charges_enabled,
         payouts_enabled = EXCLUDED.payouts_enabled,
         onboarding_complete = EXCLUDED.onboarding_complete,
         details_submitted = EXCLUDED.details_submitted,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        input.propertyId,
        input.stripeAccountId,
        input.chargesEnabled,
        input.payoutsEnabled,
        input.onboardingComplete,
        input.detailsSubmitted,
      ]
    );
    return mapRow(result.rows[0] as Record<string, unknown>);
  },
};
