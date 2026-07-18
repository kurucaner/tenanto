import { CalendarPlus, SquarePen } from "lucide-react";
import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format-money";
import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import {
  type IPropertyLongStay,
  isActiveLeaseInHoldover,
  PropertyLongStayStatus,
} from "@/packages/shared";

interface LeaseDetailHeaderProps {
  canManage: boolean;
  currentRent: number;
  lease: IPropertyLongStay;
  onEndLease: () => void;
  onExtendLease: () => void;
  unitLabel: string;
}

export const LeaseDetailHeader = memo(
  ({
    canManage,
    currentRent,
    lease,
    onEndLease,
    onExtendLease,
    unitLabel,
  }: LeaseDetailHeaderProps) => {
    const isActive = lease.status === PropertyLongStayStatus.ACTIVE;
    const isInHoldover = isActiveLeaseInHoldover(lease, getTodayLocalIsoDate());

    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{lease.guestName}</h1>
            <Badge variant={isActive ? "default" : "secondary"}>
              {isActive ? "Active" : "Ended"}
            </Badge>
            {isInHoldover ? <Badge variant="outline">Holdover</Badge> : null}
          </div>
          <p className="text-muted-foreground text-sm">
            Unit {unitLabel} · {formatMoney(currentRent)}/mo
            {isInHoldover ? " · Contract ended" : null}
          </p>
        </div>

        {canManage && isActive ? (
          <div className="flex flex-wrap gap-2">
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
