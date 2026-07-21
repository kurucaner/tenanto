import { memo } from "react";
import { Link } from "react-router-dom";

import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/packages/app-ui";
import { centsToDollars, type ITenantRentSummaryLease } from "@/packages/shared";

function formatUsdFromCents(cents: number, currency: string): string {
  return centsToDollars(cents).toLocaleString(undefined, {
    currency: currency.toUpperCase(),
    style: "currency",
  });
}

interface PayRentLeasePickerRowProps {
  checkoutLeaseId: string | undefined;
  currency: string;
  isStartingCheckout: boolean;
  lease: ITenantRentSummaryLease;
  onPay: (leaseId: string) => void;
}

const PayRentLeasePickerRow = memo(function PayRentLeasePickerRow({
  checkoutLeaseId,
  currency,
  isStartingCheckout,
  lease,
  onPay,
}: PayRentLeasePickerRowProps) {
  const isPayingThisLease = isStartingCheckout && checkoutLeaseId === lease.leaseId;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card/85 p-4 shadow-sm">
      <div className="space-y-1">
        <p className="font-medium text-foreground">{lease.propertyName}</p>
        <p className="text-sm text-muted-foreground">{lease.unitLabel}</p>
        <p className="text-sm text-foreground">
          Amount due:{" "}
          <span className="font-medium">{formatUsdFromCents(lease.amountDueCents, currency)}</span>
        </p>
      </div>
      {lease.paymentsEnabled ? (
        <Button disabled={isStartingCheckout} onClick={() => onPay(lease.leaseId)} type="button">
          {isPayingThisLease ? "Redirecting…" : "Pay rent"}
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Online payments aren&apos;t available for this lease yet.
          </p>
          <Button asChild type="button" variant="outline">
            <Link to={`/leases/${lease.leaseId}`}>View lease</Link>
          </Button>
        </div>
      )}
    </div>
  );
});
PayRentLeasePickerRow.displayName = "PayRentLeasePickerRow";

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
            <PayRentLeasePickerRow
              checkoutLeaseId={checkoutLeaseId}
              currency={currency}
              isStartingCheckout={isStartingCheckout}
              key={lease.leaseId}
              lease={lease}
              onPay={onPay}
            />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
});
PayRentLeasePickerSheet.displayName = "PayRentLeasePickerSheet";
