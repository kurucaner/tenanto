import { memo } from "react";
import { Link } from "react-router-dom";

import { LeasePayActions } from "@/components/portal/lease-due-row";
import { formatUsdFromCents } from "@/lib/format-usd-from-cents";
import { formatDuePeriodsLabel } from "@/lib/rent-summary-utils";
import { Button, TenantLeaseCard } from "@/packages/app-ui";
import { type ITenantLeaseListItem, type ITenantRentSummaryLease } from "@/packages/shared";

interface ActiveLeaseCardProps {
  currency: string;
  lease: ITenantLeaseListItem;
  rentSummaryLease?: ITenantRentSummaryLease;
  tenantDisplayName?: string;
}

export const ActiveLeaseCard = memo(function ActiveLeaseCard({
  currency,
  lease,
  rentSummaryLease,
  tenantDisplayName,
}: ActiveLeaseCardProps) {
  const leaseDetailPath = `/leases/${lease.leaseId}`;
  const hasDue = rentSummaryLease != null && rentSummaryLease.amountDueCents > 0;
  const amountDueLabel =
    hasDue && rentSummaryLease
      ? formatUsdFromCents(rentSummaryLease.amountDueCents, currency)
      : undefined;
  const duePeriodsLabel =
    hasDue && rentSummaryLease ? formatDuePeriodsLabel(rentSummaryLease.duePeriodKeys) : null;

  const footer =
    hasDue && rentSummaryLease ? (
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {duePeriodsLabel ? (
          <p className="min-w-0 text-sm text-muted-foreground">Due: {duePeriodsLabel}</p>
        ) : (
          <span />
        )}
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <LeasePayActions isCaughtUp={false} isInline lease={rentSummaryLease} />
          <Button asChild className="w-full sm:w-auto" type="button" variant="ghost">
            <Link to={leaseDetailPath}>View lease details</Link>
          </Button>
        </div>
      </div>
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
