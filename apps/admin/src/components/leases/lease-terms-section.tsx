import { CalendarPlus, SquarePen } from "lucide-react";
import { memo, useState } from "react";

import { EditLeaseTermsDialog } from "@/components/leases/edit-lease-terms-dialog";
import { ExtendLeaseDialog } from "@/components/leases/extend-lease-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/format-money";
import { formatLeaseMonthLabel } from "@/lib/lease-month-label";
import {
  getLeaseTermsEditBlockMessage,
  type ILeaseTermsEditability,
  type IPropertyLongStay,
  type IPropertyLongStayRentPeriod,
  PropertyLongStayStatus,
} from "@/packages/shared";

interface LeaseTermsSectionProps {
  canManage: boolean;
  lease: IPropertyLongStay;
  propertyId: string;
  rentPeriods: IPropertyLongStayRentPeriod[];
  termsEditability: ILeaseTermsEditability;
}

function getLeaseTermsBlockedCopy(termsEditability: ILeaseTermsEditability): string {
  if (termsEditability.reason) {
    return getLeaseTermsEditBlockMessage(termsEditability.reason);
  }

  return "Lease terms cannot be edited.";
}

export const LeaseTermsSection = memo(
  ({ canManage, lease, propertyId, rentPeriods, termsEditability }: LeaseTermsSectionProps) => {
    const [editOpen, setEditOpen] = useState(false);
    const [extendOpen, setExtendOpen] = useState(false);
    const isActive = lease.status === PropertyLongStayStatus.ACTIVE;
    const canExtend = canManage && isActive;
    const canEditTerms = canManage && isActive && termsEditability.editable;
    const showBlockedCopy = isActive && !termsEditability.editable;
    const showTermsDivider = canEditTerms || showBlockedCopy;

    return (
      <>
        <Card>
          <CardContent className="space-y-4 p-6">
            {isActive ? (
              <>
                {canEditTerms ? (
                  <div className="space-y-3">
                    <p className="text-muted-foreground text-sm">
                      Correct the lease start date, term, or base monthly rent before any rent is
                      recorded.
                    </p>
                    <Button
                      className="gap-1.5"
                      onClick={() => setEditOpen(true)}
                      type="button"
                      variant="outline"
                    >
                      <SquarePen className="size-3.5" />
                      Edit terms
                    </Button>
                  </div>
                ) : null}

                {showBlockedCopy ? (
                  <p className="text-muted-foreground text-sm">
                    {getLeaseTermsBlockedCopy(termsEditability)} Use Extend lease or End lease
                    instead.
                  </p>
                ) : null}

                {canExtend ? (
                  <div className={showTermsDivider ? "space-y-3 border-t pt-4" : "space-y-3"}>
                    <p className="text-muted-foreground text-sm">
                      Extend the lease term by adding months. You can optionally set a new monthly
                      rent effective from a month in the extension period.
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
                  </div>
                ) : null}
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

        {editOpen ? (
          <EditLeaseTermsDialog
            key={`${lease.id}-edit-terms`}
            lease={lease}
            onOpenChange={setEditOpen}
            open={true}
            propertyId={propertyId}
          />
        ) : null}

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
