import { memo } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format-money";
import {
  formatRateAsPercent,
  getStayAverageDailyRate,
  getStayTaxesTotal,
  type IPropertyReservation,
} from "@/packages/shared";

interface StayTaxesDetailsDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  stay: IPropertyReservation | null;
}

function getTaxableSubtotal(stay: IPropertyReservation): number {
  return Math.round((stay.roomTotal + stay.cleaningFee) * 100) / 100;
}

const FeeLineRow = memo(({ amount, label }: { amount: number; label: string }) => (
  <div className="flex items-center justify-between gap-4 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="tabular-nums">{formatMoney(amount)}</span>
  </div>
));
FeeLineRow.displayName = "FeeLineRow";

export const StayTaxesDetailsDialog = memo(
  ({ onOpenChange, open, stay }: StayTaxesDetailsDialogProps) => {
    if (!stay) {
      return null;
    }

    const taxesTotal = getStayTaxesTotal(stay);
    const avgDailyRate = getStayAverageDailyRate(stay);
    const taxableSubtotal = getTaxableSubtotal(stay);
    const roomLabel =
      stay.nights === 1
        ? `Room (${formatMoney(stay.roomTotal)} total)`
        : `Room (${formatMoney(stay.roomTotal)} total, ${formatMoney(avgDailyRate)}/night × ${stay.nights} nights)`;

    return (
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Taxes</DialogTitle>
            <DialogDescription>
              {stay.guestName} · {stay.checkIn} to {stay.checkOut}
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-2 border-b pb-4">
              <FeeLineRow amount={stay.roomTotal} label={roomLabel} />
              <FeeLineRow amount={stay.cleaningFee} label="Cleaning fee" />
              <div className="flex items-center justify-between gap-4 text-sm font-medium">
                <span>Taxable subtotal</span>
                <span className="tabular-nums">{formatMoney(taxableSubtotal)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {stay.taxBreakdown.map((tax) => (
                <FeeLineRow
                  amount={tax.amount}
                  key={tax.taxRateId}
                  label={`${tax.name} (${formatRateAsPercent(tax.rate)}%)`}
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-4 border-t pt-4 text-sm font-medium">
              <span>Total taxes</span>
              <span className="tabular-nums">{formatMoney(taxesTotal)}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);
StayTaxesDetailsDialog.displayName = "StayTaxesDetailsDialog";
