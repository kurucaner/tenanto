/** Stripe Checkout / PaymentIntent lifecycle for a tenant rent charge. */
export const TenantRentPaymentStatus = {
  CANCELED: "canceled",
  FAILED: "failed",
  PENDING: "pending",
  PROCESSING: "processing",
  REFUNDED: "refunded",
  REQUIRES_ACTION: "requires_action",
  SUCCEEDED: "succeeded",
} as const;

export type TTenantRentPaymentStatus =
  (typeof TenantRentPaymentStatus)[keyof typeof TenantRentPaymentStatus];

const TERMINAL_TENANT_RENT_PAYMENT_STATUSES = new Set<TTenantRentPaymentStatus>([
  TenantRentPaymentStatus.CANCELED,
  TenantRentPaymentStatus.FAILED,
  TenantRentPaymentStatus.REFUNDED,
  TenantRentPaymentStatus.SUCCEEDED,
]);

export function isTerminalTenantRentPaymentStatus(status: TTenantRentPaymentStatus): boolean {
  return TERMINAL_TENANT_RENT_PAYMENT_STATUSES.has(status);
}

/** One schedule month in a lease balance response. */
export interface ITenantLeaseBalancePeriod {
  expectedCents: number;
  month: string;
  paidCents: number;
  remainingCents: number;
}

export interface ITenantLeaseBalanceResponse {
  amountDueCents: number;
  currency: string;
  leaseId: string;
  periods: ITenantLeaseBalancePeriod[];
}

/**
 * Create Checkout: selected months + total amount (≤ sum remaining of selected).
 * Server recomputes remaining; client amounts are not trusted alone.
 */
export interface ITenantCreateRentCheckoutBody {
  amountCents: number;
  leaseId: string;
  periodMonths: string[];
}

export interface ITenantCreateRentCheckoutResponse {
  checkoutUrl: string;
  paymentId: string;
}

export interface ITenantRentPaymentStatusResponse {
  amountCents: number;
  currency: string;
  id: string;
  leaseId: string;
  status: TTenantRentPaymentStatus;
}

/** Admin: property Connect onboarding status. */
export interface IPropertyStripeConnectStatusResponse {
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingComplete: boolean;
  payoutsEnabled: boolean;
  stripeAccountId: string | null;
}

export interface IPropertyStripeConnectOnboardingLinkResponse {
  url: string;
}
