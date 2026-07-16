import { tenantPortalApi } from "@/lib/api-client";
import { selectDuePeriodMonths, transactionDateToMonth } from "@/packages/shared";

/** UTC calendar date YYYY-MM-DD (matches server `getTodayUtcIsoDate`). */
function todayUtcIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Load balance for the lease and open Stripe Checkout for the current amount due.
 * Redirects the window on success.
 */
export async function startRentCheckoutForAmountDue(leaseId: string): Promise<void> {
  const balance = await tenantPortalApi.getLeaseBalance(leaseId);
  if (!balance.paymentsEnabled) {
    throw new Error("Online payments aren’t available for this lease yet.");
  }
  if (balance.amountDueCents <= 0) {
    throw new Error("Nothing is due right now.");
  }

  const asOfMonth = transactionDateToMonth(todayUtcIsoDate());
  const periodMonths = selectDuePeriodMonths(balance.periods, asOfMonth);
  if (periodMonths.length === 0) {
    throw new Error("Nothing is due right now.");
  }

  const result = await tenantPortalApi.createRentCheckout(leaseId, {
    amountCents: balance.amountDueCents,
    leaseId,
    periodMonths,
  });
  window.location.assign(result.checkoutUrl);
}
