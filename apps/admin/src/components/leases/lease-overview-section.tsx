import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/format-money";
import { type IPropertyLongStay, PropertyLongStayStatus } from "@/packages/shared";

interface LeaseOverviewSectionProps {
  currentRent: number;
  lease: IPropertyLongStay;
}

export const LeaseOverviewSection = memo(({ currentRent, lease }: LeaseOverviewSectionProps) => {
  const endDate = lease.actualEndDate ?? lease.leaseEndDate;

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Badge variant={lease.status === PropertyLongStayStatus.ACTIVE ? "default" : "secondary"}>
            {lease.status === PropertyLongStayStatus.ACTIVE ? "Active" : "Ended"}
          </Badge>
          <span className="text-muted-foreground text-sm">{formatMoney(currentRent)}/mo</span>
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Lease period</dt>
            <dd className="font-medium">
              {new Date(`${lease.leaseStartDate}T00:00:00`).toLocaleDateString()} →{" "}
              {new Date(`${endDate}T00:00:00`).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Term</dt>
            <dd className="font-medium">{lease.termMonths} months</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Lease start</dt>
            <dd className="font-medium">
              {new Date(`${lease.leaseStartDate}T00:00:00`).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Lease end</dt>
            <dd className="font-medium">{new Date(`${endDate}T00:00:00`).toLocaleDateString()}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
});
LeaseOverviewSection.displayName = "LeaseOverviewSection";
