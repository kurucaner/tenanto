import { CalendarPlus, SquarePen } from "lucide-react";
import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format-money";
import { getLeaseRentAmountSuffix } from "@/lib/lease-rent-schedule-display";
import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import {
  type IPropertyLongStay,
  isActiveLeaseInHoldover,
  PropertyLongStayStatus,
} from "@/packages/shared";

interface LeaseDetailActionsProps {
  canManage: boolean;
  lease: IPropertyLongStay;
  onEndLease: () => void;
  onExtendLease: () => void;
}

export const LeaseDetailActions = memo(
  ({ canManage, lease, onEndLease, onExtendLease }: LeaseDetailActionsProps) => {
    const isActive = lease.status === PropertyLongStayStatus.ACTIVE;

    if (!canManage || !isActive) {
      return null;
    }

    return (
      <div className="flex flex-wrap gap-2 ml-auto">
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
        <Button className="gap-1.5" onClick={onEndLease} size="sm" type="button" variant="outline">
          <SquarePen className="size-3.5" />
          End Lease
        </Button>
      </div>
    );
  }
);
LeaseDetailActions.displayName = "LeaseDetailActions";

interface LeaseDetailHeaderProps {
  currentRent: number;
  lease: IPropertyLongStay;
  unitLabel: string;
}

export const LeaseDetailHeader = memo(
  ({ currentRent, lease, unitLabel }: LeaseDetailHeaderProps) => {
    const isActive = lease.status === PropertyLongStayStatus.ACTIVE;
    const isInHoldover = isActiveLeaseInHoldover(lease, getTodayLocalIsoDate());

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{lease.guestName}</h1>
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? "Active" : "Ended"}
          </Badge>
          {isInHoldover ? <Badge variant="outline">Holdover</Badge> : null}
        </div>
        <p className="text-muted-foreground text-sm">
          Unit {unitLabel} · {formatMoney(currentRent)}
          {getLeaseRentAmountSuffix(lease.rentBillingCadence)}
          {isInHoldover ? " · Contract ended" : null}
        </p>
      </div>
    );
  }
);
LeaseDetailHeader.displayName = "LeaseDetailHeader";
