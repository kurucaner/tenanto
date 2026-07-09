import { CalendarPlus } from "lucide-react";
import { memo, useState } from "react";

import { ExtendLeaseDialog } from "@/components/leases/extend-lease-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/format-money";
import { formatLeaseMonthLabel } from "@/lib/lease-month-label";
import {
  type IPropertyLongStay,
  type IPropertyLongStayRentPeriod,
  PropertyLongStayStatus,
} from "@/packages/shared";

interface LeaseTermsSectionProps {
  canManage: boolean;
  lease: IPropertyLongStay;
  propertyId: string;
  rentPeriods: IPropertyLongStayRentPeriod[];
}

export const LeaseTermsSection = memo(
  ({ canManage, lease, propertyId, rentPeriods }: LeaseTermsSectionProps) => {
    const [extendOpen, setExtendOpen] = useState(false);
    const canExtend = canManage && lease.status === PropertyLongStayStatus.ACTIVE;

    return (
      <>
        <Card>
          <CardContent className="space-y-4 p-6">
            {canExtend ? (
              <>
                <p className="text-muted-foreground text-sm">
                  Extend the lease term by adding months. You can optionally set a new monthly rent
                  effective from a month in the extension period.
                </p>
                <Button
                  className="gap-1.5"
                  onClick={() => setExtendOpen(true)}
                  type="button"
                  variant="outline"
                >
                  <CalendarPlus className="size-3.5" />
                  Extend lease
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                This lease has ended. Term changes are not available.
              </p>
            )}

            {rentPeriods.length > 0 ? (
              <div className="space-y-2 border-t pt-4">
                <p className="text-muted-foreground text-xs">Rent history</p>
                <ul className="space-y-1 text-sm">
                  {rentPeriods.map((period) => (
                    <li
                      className="flex items-center justify-between gap-2"
                      key={period.effectiveFromMonth}
                    >
                      <span>{formatLeaseMonthLabel(period.effectiveFromMonth)}</span>
                      <span className="font-medium">{formatMoney(period.monthlyRent)}/mo</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {extendOpen ? (
          <ExtendLeaseDialog
            key={`${lease.id}-extend`}
            lease={lease}
            onOpenChange={setExtendOpen}
            open={true}
            propertyId={propertyId}
          />
        ) : null}
      </>
    );
  }
);
LeaseTermsSection.displayName = "LeaseTermsSection";
