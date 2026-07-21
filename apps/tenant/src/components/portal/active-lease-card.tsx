import { memo } from "react";
import { Link } from "react-router-dom";

import { LeasePayActions } from "@/components/portal/lease-due-row";
import { formatUsdFromCents } from "@/lib/format-usd-from-cents";
import { Button, TenantLeaseCard } from "@/packages/app-ui";
import { type ITenantLeaseListItem, type ITenantRentSummaryLease } from "@/packages/shared";

interface ActiveLeaseCardProps {
  checkoutLeaseId: string | undefined;
  currency: string;
  isStartingCheckout: boolean;
  lease: ITenantLeaseListItem;
  onPay: (leaseId: string) => void;
  rentSummaryLease?: ITenantRentSummaryLease;
  tenantDisplayName?: string;
}

export const ActiveLeaseCard = memo(function ActiveLeaseCard({
  checkoutLeaseId,
  currency,
  isStartingCheckout,
  lease,
  onPay,
  rentSummaryLease,
  tenantDisplayName,
}: ActiveLeaseCardProps) {
  const leaseDetailPath = `/leases/${lease.leaseId}`;
  const hasDue = rentSummaryLease != null && rentSummaryLease.amountDueCents > 0;
  const amountDueLabel =
    hasDue && rentSummaryLease
      ? formatUsdFromCents(rentSummaryLease.amountDueCents, currency)
      : undefined;

  const footer = hasDue && rentSummaryLease ? (
    <>
      <LeasePayActions
        isCaughtUp={false}
        isInline={false}
        isPayingThisLease={isStartingCheckout && checkoutLeaseId === lease.leaseId}
        isStartingCheckout={isStartingCheckout}
        lease={rentSummaryLease}
        onPay={onPay}
      />
      <Button asChild className="w-full sm:ms-auto sm:w-auto" type="button" variant="ghost">
        <Link to={leaseDetailPath}>View lease details</Link>
      </Button>
    </>
  ) : undefined;

  return (
    <TenantLeaseCard
      amountDueLabel={amountDueLabel}
      footer={footer}
      leaseEndDate={lease.leaseEndDate}
      leaseStartDate={lease.leaseStartDate}
      propertyName={lease.propertyName}
      role={lease.role}
      status={lease.status}
      tenantDisplayName={tenantDisplayName}
      to={hasDue ? undefined : leaseDetailPath}
      unitLabel={lease.unitLabel}
    />
  );
});
ActiveLeaseCard.displayName = "ActiveLeaseCard";
