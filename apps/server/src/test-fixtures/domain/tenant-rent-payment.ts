import { type ITenantRentPayment } from "@/db/tenant-rent-payments";
import { buildRentCheckoutIdempotencyKey, TenantRentPaymentStatus } from "@/packages/shared";

export function makeTenantRentPayment(
  overrides: Partial<ITenantRentPayment> = {}
): ITenantRentPayment {
  const amountCents = overrides.amountCents ?? 200_00;
  const feeCents = overrides.feeCents ?? 0;
  return {
    amountCents,
    chargeCents: overrides.chargeCents ?? amountCents + feeCents,
    connectedAccountId: "acct_1",
    createdAt: "2026-01-01T00:00:00.000Z",
    currency: "usd",
    feeCents,
    id: "payment-1",
    idempotencyKey: buildRentCheckoutIdempotencyKey({
      amountCents,
      leaseId: "lease-1",
      periodMonths: ["2026-01"],
      tenantUserId: "tenant-1",
    }),
    leaseId: "lease-1",
    paymentMethodFamily: null,
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
