import { useQuery } from "@tanstack/react-query";
import { Check, CircleDollarSign } from "lucide-react";
import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { longStaysApi } from "@/lib/api-client";
import { formatMoney } from "@/lib/format-money";
import { adminQueryKeys } from "@/lib/query-keys";
import {
  type IPropertyLongStay,
  PropertyLongStayStatus,
} from "@/packages/shared";

interface LeaseDetailSheetProps {
  lease: IPropertyLongStay | null;
  onOpenChange: (open: boolean) => void;
  onRecordRent: (lease: IPropertyLongStay, month?: string) => void;
  open: boolean;
  propertyId: string;
  unitLabelById: Map<string, string>;
}

function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  return new Date(year, monthNum - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export const LeaseDetailSheet = memo(
  ({
    lease,
    onOpenChange,
    onRecordRent,
    open,
    propertyId,
    unitLabelById,
  }: LeaseDetailSheetProps) => {
    const detailQuery = useQuery({
      enabled: open && lease != null,
      queryFn: () => longStaysApi.get(propertyId, lease!.id),
      queryKey: adminQueryKeys.propertyLongStay(propertyId, lease?.id ?? ""),
    });

    const detail = detailQuery.data;
    const displayLease = detail?.longStay ?? lease;
    const rentSchedule = detail?.rentSchedule ?? [];

    return (
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {displayLease ? (
            <>
              <SheetHeader>
                <SheetTitle>{displayLease.guestName}</SheetTitle>
                <SheetDescription>
                  Unit {unitLabelById.get(displayLease.unitId) ?? displayLease.unitId}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 flex flex-col gap-6 px-4 pb-6">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      displayLease.status === PropertyLongStayStatus.ACTIVE ? "default" : "secondary"
                    }
                  >
                    {displayLease.status === PropertyLongStayStatus.ACTIVE ? "Active" : "Ended"}
                  </Badge>
                  <span className="text-muted-foreground text-sm">
                    {formatMoney(displayLease.monthlyRent)}/mo
                  </span>
                </div>

                <dl className="grid gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Lease period</dt>
                    <dd className="font-medium">
                      {new Date(`${displayLease.leaseStartDate}T00:00:00`).toLocaleDateString()} →{" "}
                      {new Date(
                        `${displayLease.actualEndDate ?? displayLease.leaseEndDate}T00:00:00`
                      ).toLocaleDateString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Term</dt>
                    <dd className="font-medium">{displayLease.termMonths} months</dd>
                  </div>
                  {displayLease.tenantEmail ? (
                    <div>
                      <dt className="text-muted-foreground">Email</dt>
                      <dd className="font-medium">{displayLease.tenantEmail}</dd>
                    </div>
                  ) : null}
                  {displayLease.tenantPhone ? (
                    <div>
                      <dt className="text-muted-foreground">Phone</dt>
                      <dd className="font-medium">{displayLease.tenantPhone}</dd>
                    </div>
                  ) : null}
                </dl>

                {displayLease.status === PropertyLongStayStatus.ACTIVE ? (
                  <Button
                    className="gap-1.5"
                    onClick={() => onRecordRent(displayLease)}
                    type="button"
                  >
                    <CircleDollarSign className="size-3.5" />
                    Record Rent
                  </Button>
                ) : null}

                <div>
                  <h3 className="mb-3 text-sm font-medium">Rent Schedule</h3>
                  {detailQuery.isPending ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : rentSchedule.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No rent months in this lease.</p>
                  ) : (
                    <ul className="divide-y rounded-md border">
                      {rentSchedule.map((item) => (
                        <li className="flex items-center justify-between gap-3 px-3 py-2.5" key={item.month}>
                          <div className="flex items-center gap-2">
                            {item.isPaid ? (
                              <Check className="size-4 text-green-600" />
                            ) : (
                              <span className="inline-block size-4 rounded-full border" />
                            )}
                            <span className="text-sm">{formatMonthLabel(item.month)}</span>
                          </div>
                          {item.isPaid ? (
                            <Badge variant="secondary">Paid</Badge>
                          ) : displayLease.status === PropertyLongStayStatus.ACTIVE ? (
                            <Button
                              onClick={() => onRecordRent(displayLease, item.month)}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              Record
                            </Button>
                          ) : (
                            <Badge variant="outline">Missing</Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    );
  }
);
LeaseDetailSheet.displayName = "LeaseDetailSheet";
