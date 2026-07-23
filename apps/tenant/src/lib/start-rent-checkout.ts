import { tenantPortalApi } from "@/lib/api-client";
import { RentPaymentMethodFamily, type TRentPaymentMethodFamily } from "@/packages/shared";

/**
 * Load balance for the lease and open Stripe Checkout for the current amount due.
 * Server computes periods/amount; redirects the window on success.
 */
export async function startRentCheckoutForAmountDue(
  leaseId: string,
  paymentMethodFamily: TRentPaymentMethodFamily = RentPaymentMethodFamily.US_BANK_ACCOUNT
): Promise<void> {
  const balance = await tenantPortalApi.getLeaseBalance(leaseId);
  if (!balance.paymentsEnabled) {
    throw new Error("Online payments aren’t available for this lease yet.");
  }
  if (balance.amountDueCents <= 0) {
    throw new Error("Nothing is due right now.");
  }

  const result = await tenantPortalApi.createRentCheckout(leaseId, { paymentMethodFamily });
  globalThis.location.assign(result.checkoutUrl);
}
