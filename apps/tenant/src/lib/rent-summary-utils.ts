import type { ITenantRentSummaryLease, ITenantRentSummaryResponse } from "@/packages/shared";

export type TRentPayAction =
  { kind: "checkout"; leaseId: string } | { kind: "navigate"; href: string };

/**
 * Home Pay rent: start Checkout when a single due lease has payments enabled;
 * otherwise navigate (lease list or lease detail when online pay is unavailable).
 */
export function resolveRentPayAction(summary: ITenantRentSummaryResponse): TRentPayAction {
  const withDue = summary.leases.filter((lease) => lease.amountDueCents > 0);
  if (withDue.length === 0) {
    return { href: "/leases", kind: "navigate" };
  }

  const payable = withDue.filter((lease) => lease.paymentsEnabled);
  if (withDue.length === 1 && payable.length === 1) {
    const only = payable[0];
    return only
      ? { kind: "checkout", leaseId: only.leaseId }
      : { href: "/leases", kind: "navigate" };
  }

  if (withDue.length === 1) {
    const only = withDue[0];
    return only
      ? { href: `/leases/${only.leaseId}`, kind: "navigate" }
      : { href: "/leases", kind: "navigate" };
  }

  return { href: "/leases", kind: "navigate" };
}

export function hasOnlinePayAvailable(leases: ITenantRentSummaryLease[]): boolean {
  return leases.some((lease) => lease.amountDueCents > 0 && lease.paymentsEnabled);
}
