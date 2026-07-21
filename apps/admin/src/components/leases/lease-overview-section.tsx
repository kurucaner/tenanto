import { memo } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { getActiveLeaseHoldoverNotice } from "@/lib/lease-proration-display";
import {
  getLeaseBillingCadenceLabel,
  getLeaseTermDisplayLabel,
} from "@/lib/lease-rent-schedule-display";
import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import {
  type IPropertyLongStay,
  isActiveLeaseInHoldover,
  isCustomLeaseEndDate,
} from "@/packages/shared";

interface LeaseOverviewSectionProps {
  lease: IPropertyLongStay;
}

export const LeaseOverviewSection = memo(({ lease }: LeaseOverviewSectionProps) => {
  const today = getTodayLocalIsoDate();
  const isInHoldover = isActiveLeaseInHoldover(lease, today);
  const endDate = lease.actualEndDate ?? lease.leaseEndDate;
  const hasCustomEnd = isCustomLeaseEndDate(
    lease.leaseStartDate,
    lease.termMonths,
    lease.leaseEndDate
  );

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        {isInHoldover ? (
          <p className="text-muted-foreground text-sm">
            {getActiveLeaseHoldoverNotice(lease.leaseEndDate)}
          </p>
        ) : null}
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Lease period</dt>
            <dd className="font-medium">
              {new Date(`${lease.leaseStartDate}T00:00:00`).toLocaleDateString()} →{" "}
              {new Date(`${endDate}T00:00:00`).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Rent billing</dt>
            <dd className="font-medium">{getLeaseBillingCadenceLabel(lease.rentBillingCadence)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Term</dt>
            <dd className="font-medium">{getLeaseTermDisplayLabel(lease)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Lease start</dt>
            <dd className="font-medium">
              {new Date(`${lease.leaseStartDate}T00:00:00`).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Contract end</dt>
            <dd className="font-medium">
              {new Date(`${lease.leaseEndDate}T00:00:00`).toLocaleDateString()}
              {hasCustomEnd ? (
                <span className="text-muted-foreground ml-2 text-xs font-normal">Custom end</span>
              ) : null}
            </dd>
          </div>
          {lease.actualEndDate ? (
            <div>
              <dt className="text-muted-foreground">Actual move-out</dt>
              <dd className="font-medium">
                {new Date(`${lease.actualEndDate}T00:00:00`).toLocaleDateString()}
              </dd>
            </div>
          ) : null}
        </dl>
      </CardContent>
    </Card>
  );
});
LeaseOverviewSection.displayName = "LeaseOverviewSection";
