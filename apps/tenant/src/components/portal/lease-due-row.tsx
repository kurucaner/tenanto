import { memo } from "react";
import { Link } from "react-router-dom";

import { formatUsdFromCents } from "@/lib/format-usd-from-cents";
import { formatDuePeriodsLabel } from "@/lib/rent-summary-utils";
import { Button } from "@/packages/app-ui";
import { type ITenantRentSummaryLease } from "@/packages/shared";

interface LeasePayActionsProps {
  isCaughtUp: boolean;
  isInline: boolean;
  isPayingThisLease: boolean;
  isStartingCheckout: boolean;
  lease: ITenantRentSummaryLease;
  onPay: (leaseId: string) => void;
}

export const LeasePayActions = memo(function LeasePayActions({
  isCaughtUp,
  isInline,
  isPayingThisLease,
  isStartingCheckout,
  lease,
  onPay,
}: LeasePayActionsProps) {
  const buttonClassName = isInline ? "w-full sm:w-auto" : "w-full";

  if (isCaughtUp) {
    return (
      <Button asChild className={buttonClassName} type="button" variant="outline">
        <Link to={`/leases/${lease.leaseId}`}>View lease</Link>
      </Button>
    );
  }

  if (!lease.paymentsEnabled) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Online payments aren&apos;t available for this lease yet.
        </p>
        <Button asChild className={buttonClassName} type="button" variant="outline">
          <Link to={`/leases/${lease.leaseId}`}>View lease</Link>
        </Button>
      </div>
    );
  }

  return (
    <Button
      className={buttonClassName}
      disabled={isStartingCheckout}
      onClick={() => onPay(lease.leaseId)}
      type="button"
    >
      {isPayingThisLease ? "Redirecting…" : "Pay rent"}
    </Button>
  );
});
LeasePayActions.displayName = "LeasePayActions";

interface LeaseDueRowProps {
  checkoutLeaseId: string | undefined;
  currency: string;
  isStartingCheckout: boolean;
  lease: ITenantRentSummaryLease;
  onPay: (leaseId: string) => void;
  variant?: "card" | "inline";
}

export const LeaseDueRow = memo(function LeaseDueRow({
  checkoutLeaseId,
  currency,
  isStartingCheckout,
  lease,
  onPay,
  variant = "card",
}: LeaseDueRowProps) {
  const isPayingThisLease = isStartingCheckout && checkoutLeaseId === lease.leaseId;
  const isCaughtUp = lease.amountDueCents <= 0;
  const isInline = variant === "inline";
  const duePeriodsLabel = formatDuePeriodsLabel(lease.duePeriodKeys);

  return (
    <div
      className={
        isInline
          ? "flex flex-col gap-3 rounded-xl border border-border/80 bg-card/85 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          : "flex flex-col gap-3 rounded-xl border border-border/80 bg-card/85 p-4 shadow-sm"
      }
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium text-foreground">{lease.propertyName}</p>
        <p className="text-sm text-muted-foreground">{lease.unitLabel}</p>
        {isCaughtUp ? (
          <p className="text-sm text-muted-foreground">You&apos;re caught up.</p>
        ) : (
          <>
            {duePeriodsLabel ? (
              <p className="text-sm text-muted-foreground">Due: {duePeriodsLabel}</p>
            ) : null}
            <p className="text-sm text-foreground">
              Amount due:{" "}
              <span className="font-medium">
                {formatUsdFromCents(lease.amountDueCents, currency)}
              </span>
            </p>
          </>
        )}
      </div>
      <div className={isInline ? "shrink-0 sm:w-auto" : undefined}>
        <LeasePayActions
          isCaughtUp={isCaughtUp}
          isInline={isInline}
          isPayingThisLease={isPayingThisLease}
          isStartingCheckout={isStartingCheckout}
          lease={lease}
          onPay={onPay}
        />
      </div>
    </div>
  );
});
LeaseDueRow.displayName = "LeaseDueRow";
