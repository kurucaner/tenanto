import { tenantPortalApi } from "@/lib/api-client";

/**
 * Load balance for the lease and open Stripe Checkout for the current amount due.
 * Server computes periods/amount; redirects the window on success.
 */
export async function startRentCheckoutForAmountDue(leaseId: string): Promise<void> {
  const balance = await tenantPortalApi.getLeaseBalance(leaseId);
  if (!balance.paymentsEnabled) {
    throw new Error("Online payments aren’t available for this lease yet.");
  }
  if (balance.amountDueCents <= 0) {
    throw new Error("Nothing is due right now.");
  }

  const result = await tenantPortalApi.createRentCheckout(leaseId);
  window.location.assign(result.checkoutUrl);
}
