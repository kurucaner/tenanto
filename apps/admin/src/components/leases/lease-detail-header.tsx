import { CalendarPlus, CircleDollarSign, SquarePen } from "lucide-react";
import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format-money";
import { type IPropertyLongStay, PropertyLongStayStatus } from "@/packages/shared";

interface LeaseDetailHeaderProps {
  canManage: boolean;
  currentRent: number;
  lease: IPropertyLongStay;
  onEndLease: () => void;
  onExtendLease: () => void;
  onRecordRent: () => void;
  unitLabel: string;
}

export const LeaseDetailHeader = memo(
  ({
    canManage,
    currentRent,
    lease,
    onEndLease,
    onExtendLease,
    onRecordRent,
    unitLabel,
  }: LeaseDetailHeaderProps) => {
    const isActive = lease.status === PropertyLongStayStatus.ACTIVE;

    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{lease.guestName}</h1>
            <Badge variant={isActive ? "default" : "secondary"}>
              {isActive ? "Active" : "Ended"}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Unit {unitLabel} · {formatMoney(currentRent)}/mo
          </p>
        </div>

        {canManage && isActive ? (
          <div className="flex flex-wrap gap-2">
            <Button className="gap-1.5" onClick={onRecordRent} size="sm" type="button">
              <CircleDollarSign className="size-3.5" />
              Record Rent
            </Button>
            <Button
              className="gap-1.5"
              onClick={onExtendLease}
              size="sm"
              type="button"
              variant="outline"
            >
              <CalendarPlus className="size-3.5" />
              Extend Lease
            </Button>
            <Button
              className="gap-1.5"
              onClick={onEndLease}
              size="sm"
              type="button"
              variant="outline"
            >
              <SquarePen className="size-3.5" />
              End Lease
            </Button>
          </div>
        ) : null}
      </div>
    );
  }
);
LeaseDetailHeader.displayName = "LeaseDetailHeader";
