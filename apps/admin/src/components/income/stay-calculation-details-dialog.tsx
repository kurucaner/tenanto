import { memo } from "react";

import { CalculationLineRow, CalculationTotalRow } from "@/components/income/calculation-line-row";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format-money";
import {
  buildStayCommissionBreakdown,
  buildStayGrossBreakdown,
  buildStayNetPayoutBreakdown,
  buildStayTaxesBreakdown,
  getStayAverageDailyRate,
  type IPropertyReservation,
  type TStayCalculationMetric,
} from "@/packages/shared";

interface StayCalculationDetailsDialogProps {
  metric: TStayCalculationMetric | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  stay: IPropertyReservation | null;
}

const METRIC_TITLES: Record<TStayCalculationMetric, string> = {
  commission: "Commission",
  gross: "Gross",
  netPayout: "Net Payout",
  taxes: "Taxes",
};

function getBreakdown(metric: TStayCalculationMetric, stay: IPropertyReservation) {
  switch (metric) {
    case "commission":
      return buildStayCommissionBreakdown(stay);
    case "gross":
      return buildStayGrossBreakdown(stay);
    case "netPayout":
      return buildStayNetPayoutBreakdown(stay);
    case "taxes":
      return buildStayTaxesBreakdown(stay);
  }
}

function getTaxesRoomLabel(stay: IPropertyReservation): string {
  const avgDailyRate = getStayAverageDailyRate(stay);
  if (stay.nights === 1) {
    return `Room (${formatMoney(stay.roomTotal)} total)`;
  }
  return `Room (${formatMoney(stay.roomTotal)} total, ${formatMoney(avgDailyRate)}/night × ${stay.nights} nights)`;
}

export const StayCalculationDetailsDialog = memo(
  ({ metric, onOpenChange, open, stay }: StayCalculationDetailsDialogProps) => {
    if (!stay || !metric) {
      return null;
    }

    const breakdown = getBreakdown(metric, stay);

    const lines =
      metric === "taxes" && breakdown.lines[0]
        ? [{ ...breakdown.lines[0], label: getTaxesRoomLabel(stay) }, ...breakdown.lines.slice(1)]
        : breakdown.lines;

    return (
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{METRIC_TITLES[metric]}</DialogTitle>
            <DialogDescription>
              {stay.guestName} · {stay.checkIn} to {stay.checkOut}
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-2">
              {metric === "taxes" ? (
                <>
                  <div className="flex flex-col gap-2 border-b pb-4">
                    {lines.slice(0, 3).map((line, index) => (
                      <CalculationLineRow
                        amount={line.amount}
                        displayValue={line.displayValue}
                        emphasis={line.emphasis}
                        key={`${line.label}-${index}`}
                        label={line.label}
                        note={line.note}
                        sign={line.sign}
                      />
                    ))}
                  </div>
                  {lines.slice(3).map((line, index) => (
                    <CalculationLineRow
                      amount={line.amount}
                      displayValue={line.displayValue}
                      emphasis={line.emphasis}
                      key={`${line.label}-${index + 3}`}
                      label={line.label}
                      note={line.note}
                      sign={line.sign}
                    />
                  ))}
                </>
              ) : (
                lines.map((line, index) =>
                  line.emphasis === "total" ? null : (
                    <CalculationLineRow
                      amount={line.amount}
                      displayValue={line.displayValue}
                      emphasis={line.emphasis}
                      key={`${line.label}-${index}`}
                      label={line.label}
                      note={line.note}
                      sign={line.sign}
                    />
                  )
                )
              )}
            </div>

            <CalculationTotalRow amount={breakdown.total} label={breakdown.totalLabel} />

            {breakdown.footnote ? (
              <p className="text-muted-foreground text-xs">{breakdown.footnote}</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);
StayCalculationDetailsDialog.displayName = "StayCalculationDetailsDialog";
