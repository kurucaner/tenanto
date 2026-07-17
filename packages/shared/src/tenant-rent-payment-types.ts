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
  /** True when property Connect has charges_enabled — gate Pay UI. */
  paymentsEnabled: boolean;
  periods: ITenantLeaseBalancePeriod[];
}

/** One active lease row in the Home rent summary. */
export interface ITenantRentSummaryLease {
  amountDueCents: number;
  leaseId: string;
  paymentsEnabled: boolean;
  propertyName: string;
  unitLabel: string;
}

/** Aggregated dues across active leases for Home. */
export interface ITenantRentSummaryResponse {
  currency: string;
  /** True when the tenant has at least one active lease membership. */
  hasActiveLease: boolean;
  /** True when the tenant has at least one ended (past) lease membership. */
  hasPastLeases: boolean;
  leases: ITenantRentSummaryLease[];
  totalAmountDueCents: number;
}

/**
 * Create Checkout body — unused for settlement. Amount due is computed server-side.
 * Clients may POST `{}`.
 */
export type ITenantCreateRentCheckoutBody = Record<string, never>;

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
  /** False when deployment has STRIPE_CONNECT_ENABLED off. */
  platformEnabled: boolean;
  stripeAccountId: string | null;
}

export interface IPropertyStripeConnectOnboardingLinkResponse {
  url: string;
}
