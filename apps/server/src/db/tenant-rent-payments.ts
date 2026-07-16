import type { TTenantRentPaymentStatus } from "@/packages/shared";
import { TenantRentPaymentStatus } from "@/packages/shared";

import { pool } from "./pool";

export interface ITenantRentPayment {
  amountCents: number;
  connectedAccountId: string;
  createdAt: string;
  currency: string;
  id: string;
  idempotencyKey: string;
  leaseId: string;
  propertyId: string;
  status: TTenantRentPaymentStatus;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  tenantUserId: string;
  updatedAt: string;
}

export interface ITenantRentPaymentAllocation {
  allocatedCents: number;
  expectedCentsSnapshot: number;
  id: string;
  paymentId: string;
  periodMonth: string;
}

function mapPaymentRow(row: Record<string, unknown>): ITenantRentPayment {
  return {
    amountCents: Number(row.amount_cents),
    connectedAccountId: row.connected_account_id as string,
    createdAt: (row.created_at as Date).toISOString(),
    currency: row.currency as string,
    id: row.id as string,
    idempotencyKey: row.idempotency_key as string,
    leaseId: row.lease_id as string,
    propertyId: row.property_id as string,
    status: row.status as TTenantRentPaymentStatus,
    stripeCheckoutSessionId: (row.stripe_checkout_session_id as string) ?? null,
    stripePaymentIntentId: (row.stripe_payment_intent_id as string) ?? null,
    tenantUserId: row.tenant_user_id as string,
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

function mapAllocationRow(row: Record<string, unknown>): ITenantRentPaymentAllocation {
  return {
    allocatedCents: Number(row.allocated_cents),
    expectedCentsSnapshot: Number(row.expected_cents_snapshot),
    id: row.id as string,
    paymentId: row.payment_id as string,
    periodMonth: row.period_month as string,
  };
}

export const tenantRentPaymentsDb = {
  async createWithAllocations(input: {
    allocations: Array<{
      allocatedCents: number;
      expectedCentsSnapshot: number;
      periodMonth: string;
    }>;
    amountCents: number;
    connectedAccountId: string;
    currency?: string;
    idempotencyKey: string;
    leaseId: string;
    propertyId: string;
    tenantUserId: string;
  }): Promise<ITenantRentPayment> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const paymentResult = await client.query(
        `INSERT INTO tenant_rent_payments (
           lease_id,
           property_id,
           tenant_user_id,
           status,
           currency,
           amount_cents,
           idempotency_key,
           connected_account_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          input.leaseId,
          input.propertyId,
          input.tenantUserId,
          TenantRentPaymentStatus.PENDING,
          input.currency ?? "usd",
          input.amountCents,
          input.idempotencyKey,
          input.connectedAccountId,
        ]
      );
      const payment = mapPaymentRow(paymentResult.rows[0] as Record<string, unknown>);

      for (const allocation of input.allocations) {
        await client.query(
          `INSERT INTO tenant_rent_payment_allocations (
             payment_id,
             period_month,
             allocated_cents,
             expected_cents_snapshot
           ) VALUES ($1, $2, $3, $4)`,
          [
            payment.id,
            allocation.periodMonth,
            allocation.allocatedCents,
            allocation.expectedCentsSnapshot,
          ]
        );
      }

      await client.query("COMMIT");
      return payment;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async findByCheckoutSessionId(sessionId: string): Promise<ITenantRentPayment | null> {
    const result = await pool.query(
      `SELECT * FROM tenant_rent_payments WHERE stripe_checkout_session_id = $1`,
      [sessionId]
    );
    if (result.rows.length === 0) return null;
    return mapPaymentRow(result.rows[0] as Record<string, unknown>);
  },

  async findById(id: string): Promise<ITenantRentPayment | null> {
    const result = await pool.query(`SELECT * FROM tenant_rent_payments WHERE id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return mapPaymentRow(result.rows[0] as Record<string, unknown>);
  },

  async findByIdempotencyKey(idempotencyKey: string): Promise<ITenantRentPayment | null> {
    const result = await pool.query(
      `SELECT * FROM tenant_rent_payments WHERE idempotency_key = $1`,
      [idempotencyKey]
    );
    if (result.rows.length === 0) return null;
    return mapPaymentRow(result.rows[0] as Record<string, unknown>);
  },

  async findByPaymentIntentId(paymentIntentId: string): Promise<ITenantRentPayment | null> {
    const result = await pool.query(
      `SELECT * FROM tenant_rent_payments WHERE stripe_payment_intent_id = $1`,
      [paymentIntentId]
    );
    if (result.rows.length === 0) return null;
    return mapPaymentRow(result.rows[0] as Record<string, unknown>);
  },

  async listAllocations(paymentId: string): Promise<ITenantRentPaymentAllocation[]> {
    const result = await pool.query(
      `SELECT * FROM tenant_rent_payment_allocations
       WHERE payment_id = $1
       ORDER BY period_month ASC`,
      [paymentId]
    );
    return result.rows.map((row) => mapAllocationRow(row as Record<string, unknown>));
  },

  /**
   * Open (non-terminal success) payments that have a PaymentIntent id,
   * created on/after `since` — candidates for Stripe reconcile.
   */
  async listReconcileCandidatesSince(since: Date): Promise<ITenantRentPayment[]> {
    const result = await pool.query(
      `SELECT * FROM tenant_rent_payments
       WHERE created_at >= $1
         AND stripe_payment_intent_id IS NOT NULL
         AND status NOT IN ($2, $3, $4, $5)
       ORDER BY created_at ASC`,
      [
        since.toISOString(),
        TenantRentPaymentStatus.SUCCEEDED,
        TenantRentPaymentStatus.FAILED,
        TenantRentPaymentStatus.CANCELED,
        TenantRentPaymentStatus.REFUNDED,
      ]
    );
    return result.rows.map((row) => mapPaymentRow(row as Record<string, unknown>));
  },

  async sumSucceededAllocatedCents(leaseId: string, periodMonth: string): Promise<number> {
    const result = await pool.query(
      `SELECT COALESCE(SUM(a.allocated_cents), 0)::int AS total
       FROM tenant_rent_payment_allocations a
       INNER JOIN tenant_rent_payments p ON p.id = a.payment_id
       WHERE p.lease_id = $1
         AND a.period_month = $2
         AND p.status = $3`,
      [leaseId, periodMonth, TenantRentPaymentStatus.SUCCEEDED]
    );
    return Number(result.rows[0]?.total ?? 0);
  },

  async sumSucceededAllocatedCentsByMonths(
    leaseId: string,
    periodMonths: string[]
  ): Promise<Map<string, number>> {
    const totals = new Map<string, number>();
    for (const month of periodMonths) {
      totals.set(month, 0);
    }
    if (periodMonths.length === 0) return totals;

    const result = await pool.query(
      `SELECT a.period_month AS month, COALESCE(SUM(a.allocated_cents), 0)::int AS total
       FROM tenant_rent_payment_allocations a
       INNER JOIN tenant_rent_payments p ON p.id = a.payment_id
       WHERE p.lease_id = $1
         AND a.period_month = ANY($2::char(7)[])
         AND p.status = $3
       GROUP BY a.period_month`,
      [leaseId, periodMonths, TenantRentPaymentStatus.SUCCEEDED]
    );
    for (const row of result.rows) {
      totals.set(row.month as string, Number(row.total));
    }
    return totals;
  },

  async updateStatus(
    paymentId: string,
    status: TTenantRentPaymentStatus,
    ids?: {
      stripeCheckoutSessionId?: string | null;
      stripePaymentIntentId?: string | null;
    }
  ): Promise<ITenantRentPayment | null> {
    const result = await pool.query(
      `UPDATE tenant_rent_payments SET
         status = $2,
         stripe_checkout_session_id = COALESCE($3, stripe_checkout_session_id),
         stripe_payment_intent_id = COALESCE($4, stripe_payment_intent_id),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [paymentId, status, ids?.stripeCheckoutSessionId ?? null, ids?.stripePaymentIntentId ?? null]
    );
    if (result.rows.length === 0) return null;
    return mapPaymentRow(result.rows[0] as Record<string, unknown>);
  },

  async updateStripeIds(
    paymentId: string,
    ids: {
      stripeCheckoutSessionId?: string | null;
      stripePaymentIntentId?: string | null;
    }
  ): Promise<ITenantRentPayment | null> {
    const result = await pool.query(
      `UPDATE tenant_rent_payments SET
         stripe_checkout_session_id = COALESCE($2, stripe_checkout_session_id),
         stripe_payment_intent_id = COALESCE($3, stripe_payment_intent_id),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [paymentId, ids.stripeCheckoutSessionId ?? null, ids.stripePaymentIntentId ?? null]
    );
    if (result.rows.length === 0) return null;
    return mapPaymentRow(result.rows[0] as Record<string, unknown>);
  },
};
