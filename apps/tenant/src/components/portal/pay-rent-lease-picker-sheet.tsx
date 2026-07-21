import { memo } from "react";

import { LeaseDueRow } from "@/components/portal/lease-due-row";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/packages/app-ui";
import { type ITenantRentSummaryLease } from "@/packages/shared";

interface PayRentLeasePickerSheetProps {
  checkoutLeaseId: string | undefined;
  currency: string;
  isStartingCheckout: boolean;
  leases: ITenantRentSummaryLease[];
  onOpenChange: (open: boolean) => void;
  onPay: (leaseId: string) => void;
  open: boolean;
}

export const PayRentLeasePickerSheet = memo(function PayRentLeasePickerSheet({
  checkoutLeaseId,
  currency,
  isStartingCheckout,
  leases,
  onOpenChange,
  onPay,
  open,
}: PayRentLeasePickerSheetProps) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full sm:max-w-md" side="bottom">
        <SheetHeader>
          <SheetTitle>Choose a lease to pay</SheetTitle>
          <SheetDescription>Select the lease you want to pay online.</SheetDescription>
        </SheetHeader>
        <div className="flex max-h-[min(60vh,28rem)] flex-col gap-3 overflow-y-auto px-4 pb-4">
          {leases.map((lease) => (
            <LeaseDueRow
              checkoutLeaseId={checkoutLeaseId}
              currency={currency}
              isStartingCheckout={isStartingCheckout}
              key={lease.leaseId}
              lease={lease}
              onPay={onPay}
              variant="card"
            />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
});
PayRentLeasePickerSheet.displayName = "PayRentLeasePickerSheet";
