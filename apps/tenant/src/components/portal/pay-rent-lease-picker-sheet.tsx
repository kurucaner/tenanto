import { memo } from "react";

import { LeaseDueRow } from "@/components/portal/lease-due-row";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/packages/app-ui";
import { type ITenantRentSummaryLease } from "@/packages/shared";

interface PayRentLeasePickerSheetProps {
  currency: string;
  leases: ITenantRentSummaryLease[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export const PayRentLeasePickerSheet = memo(function PayRentLeasePickerSheet({
  currency,
  leases,
  onOpenChange,
  open,
}: PayRentLeasePickerSheetProps) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full sm:max-w-md" side="bottom">
        <SheetHeader>
          <SheetTitle>Choose a lease to pay</SheetTitle>
          <SheetDescription>Select a lease, then choose how you want to pay.</SheetDescription>
        </SheetHeader>
        <div className="flex max-h-[min(60vh,28rem)] flex-col gap-3 overflow-y-auto px-4 pb-4">
          {leases.map((lease) => (
            <LeaseDueRow currency={currency} key={lease.leaseId} lease={lease} variant="card" />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
});
PayRentLeasePickerSheet.displayName = "PayRentLeasePickerSheet";
