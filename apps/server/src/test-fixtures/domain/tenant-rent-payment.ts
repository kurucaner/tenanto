import { type ITenantRentPayment } from "@/db/tenant-rent-payments";
import {
  buildRentCheckoutIdempotencyKey,
  RentPaymentMethodFamily,
  TenantRentPaymentStatus,
} from "@/packages/shared";

export function makeTenantRentPayment(
  overrides: Partial<ITenantRentPayment> = {}
): ITenantRentPayment {
  const amountCents = overrides.amountCents ?? 200_00;
  const feeCents = overrides.feeCents ?? 0;
  const paymentMethodFamily =
    overrides.paymentMethodFamily ?? RentPaymentMethodFamily.US_BANK_ACCOUNT;
  const leaseId = overrides.leaseId ?? "lease-1";
  const tenantUserId = overrides.tenantUserId ?? "tenant-1";
  return {
    amountCents,
    chargeCents: overrides.chargeCents ?? amountCents + feeCents,
    connectedAccountId: "acct_1",
    createdAt: "2026-01-01T00:00:00.000Z",
    currency: "usd",
    feeCents,
    id: "payment-1",
    idempotencyKey:
      overrides.idempotencyKey ??
      buildRentCheckoutIdempotencyKey({
        amountCents,
        leaseId,
        paymentMethodFamily,
        periodMonths: ["2026-01"],
        tenantUserId,
      }),
    leaseId,
    paymentMethodFamily,
    propertyId: "property-1",
    status: TenantRentPaymentStatus.PENDING,
    stripeCheckoutSessionId: "cs_existing",
    stripePaymentIntentId: "pi_existing",
    tenantUserId,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export const makePayment = makeTenantRentPayment;
