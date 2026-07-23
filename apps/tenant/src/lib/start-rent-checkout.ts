import { tenantPortalApi } from "@/lib/api-client";
import { RentPaymentMethodFamily, type TRentPaymentMethodFamily } from "@/packages/shared";

export const TENANT_RENT_ACH_UNAVAILABLE_MESSAGE =
  "Bank transfer isn't available for this property yet. Please pay by card or contact your property manager.";

/**
 * Load balance for the lease and open Stripe Checkout for the current amount due.
 * Server computes periods/amount; redirects the window on success.
 */
export async function startRentCheckoutForAmountDue(
  leaseId: string,
  paymentMethodFamily: TRentPaymentMethodFamily
): Promise<void> {
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

  const result = await tenantPortalApi.createRentCheckout(leaseId, { paymentMethodFamily });
  globalThis.location.assign(result.checkoutUrl);
}
