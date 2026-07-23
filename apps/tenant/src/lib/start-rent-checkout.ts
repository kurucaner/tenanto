import { tenantPortalApi } from "@/lib/api-client";
import { isTenantRentPaymentElementEnabled } from "@/lib/stripe-publishable-key";
import {
  isRentPaymentMethodFamily,
  RentPaymentMethodFamily,
  type ITenantLeaseBalanceResponse,
  type TRentPaymentMethodFamily,
} from "@/packages/shared";

export const TENANT_RENT_ACH_UNAVAILABLE_MESSAGE =
  "Bank transfer isn't available for this property yet. Please pay by card or contact your property manager.";

export type TRentPayFlowResult =
  | { kind: "checkout" }
  | { kind: "element"; path: string };

export function buildTenantRentPayPagePath(
  leaseId: string,
  paymentMethodFamily?: TRentPaymentMethodFamily
): string {
  const base = `/leases/${encodeURIComponent(leaseId)}/pay-rent`;
  if (paymentMethodFamily == null) {
    return base;
  }
  return `${base}?method=${encodeURIComponent(paymentMethodFamily)}`;
}

export function parseTenantRentPayMethodParam(value: string | null): TRentPaymentMethodFamily | undefined {
  return isRentPaymentMethodFamily(value) ? value : undefined;
}

export async function validateRentPayPreconditions(
  leaseId: string,
  paymentMethodFamily: TRentPaymentMethodFamily
): Promise<ITenantLeaseBalanceResponse> {
  const balance = await tenantPortalApi.getLeaseBalance(leaseId);
  if (!balance.paymentsEnabled) {
    throw new Error("Online payments aren’t available for this lease yet.");
  }
  if (balance.amountDueCents <= 0) {
    throw new Error("Nothing is due right now.");
  }
  if (
    paymentMethodFamily === RentPaymentMethodFamily.US_BANK_ACCOUNT &&
    !balance.achPaymentsEnabled
  ) {
    throw new Error(TENANT_RENT_ACH_UNAVAILABLE_MESSAGE);
  }
  return balance;
}

/**
 * Start rent pay: in-app Payment Element when publishable key is set, otherwise Stripe Checkout redirect.
 */
export async function startRentPayForAmountDue(
  leaseId: string,
  paymentMethodFamily: TRentPaymentMethodFamily
): Promise<TRentPayFlowResult> {
  await validateRentPayPreconditions(leaseId, paymentMethodFamily);

  if (isTenantRentPaymentElementEnabled()) {
    return {
      kind: "element",
      path: buildTenantRentPayPagePath(leaseId, paymentMethodFamily),
    };
  }

  await startRentCheckoutForAmountDue(leaseId, paymentMethodFamily);
  return { kind: "checkout" };
}

/**
 * Load balance for the lease and open Stripe Checkout for the current amount due.
 * Server computes periods/amount; redirects the window on success.
 */
export async function startRentCheckoutForAmountDue(
  leaseId: string,
  paymentMethodFamily: TRentPaymentMethodFamily
): Promise<void> {
  await validateRentPayPreconditions(leaseId, paymentMethodFamily);

  const result = await tenantPortalApi.createRentCheckout(leaseId, { paymentMethodFamily });
  globalThis.location.assign(result.checkoutUrl);
}
