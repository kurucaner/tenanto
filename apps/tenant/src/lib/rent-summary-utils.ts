import type { ITenantRentSummaryLease, ITenantRentSummaryResponse } from "@/packages/shared";

export type TRentPayAction =
  | { kind: "checkout"; leaseId: string }
  | { kind: "navigate"; href: string }
  | { kind: "pick-lease"; leases: ITenantRentSummaryLease[] };

export function getLeasesWithDue(leases: ITenantRentSummaryLease[]): ITenantRentSummaryLease[] {
  return leases.filter((lease) => lease.amountDueCents > 0);
}

export function getPayableLeases(leases: ITenantRentSummaryLease[]): ITenantRentSummaryLease[] {
  return leases.filter((lease) => lease.amountDueCents > 0 && lease.paymentsEnabled);
}

/**
 * Home Pay rent: start Checkout when exactly one lease is payable; open a picker when
 * multiple leases have a balance; otherwise navigate to lease list or detail.
 */
export function resolveRentPayAction(summary: ITenantRentSummaryResponse): TRentPayAction {
  const withDue = getLeasesWithDue(summary.leases);
  if (withDue.length === 0) {
    return { href: "/leases", kind: "navigate" };
  }

  const payable = getPayableLeases(summary.leases);
  if (payable.length === 1) {
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

  return { kind: "pick-lease", leases: withDue };
}

export function hasOnlinePayAvailable(leases: ITenantRentSummaryLease[]): boolean {
  return leases.some((lease) => lease.amountDueCents > 0 && lease.paymentsEnabled);
}
