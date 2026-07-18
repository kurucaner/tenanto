import { type ITenantRentPayment } from "@/db/tenant-rent-payments";
import { buildRentCheckoutIdempotencyKey, TenantRentPaymentStatus } from "@/packages/shared";

export function makeTenantRentPayment(
  overrides: Partial<ITenantRentPayment> = {}
): ITenantRentPayment {
  return {
    amountCents: 200_00,
    connectedAccountId: "acct_1",
    createdAt: "2026-01-01T00:00:00.000Z",
    currency: "usd",
    id: "payment-1",
    idempotencyKey: buildRentCheckoutIdempotencyKey({
      amountCents: 200_00,
      leaseId: "lease-1",
      periodMonths: ["2026-01"],
      tenantUserId: "tenant-1",
    }),
    leaseId: "lease-1",
    propertyId: "property-1",
    status: TenantRentPaymentStatus.PENDING,
    stripeCheckoutSessionId: "cs_existing",
    stripePaymentIntentId: "pi_existing",
    tenantUserId: "tenant-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export const makePayment = makeTenantRentPayment;
