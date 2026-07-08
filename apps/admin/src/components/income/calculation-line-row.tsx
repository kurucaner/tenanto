import { memo } from "react";

import { formatMoney } from "@/lib/format-money";
import { cn } from "@/lib/utils";

interface CalculationLineRowProps {
  amount: number;
  displayValue?: string;
  emphasis?: "normal" | "subtotal" | "total";
  label: string;
  note?: string;
  sign?: "+" | "−" | "=";
}

function getEmphasisClassName(emphasis: CalculationLineRowProps["emphasis"]): string {
  if (emphasis === "subtotal" || emphasis === "total") {
    return "font-medium";
  }
  return "";
}

export const CalculationLineRow = memo(
  ({ amount, displayValue, emphasis = "normal", label, note, sign }: CalculationLineRowProps) => (
    <div className={cn("flex items-start justify-between gap-4 text-sm", getEmphasisClassName(emphasis))}>
      <div className="min-w-0">
        <span className={emphasis === "total" ? undefined : "text-muted-foreground"}>{label}</span>
        {note ? <p className="text-muted-foreground text-xs">{note}</p> : null}
      </div>
      <span className="shrink-0 tabular-nums">
        {sign ? `${sign} ` : ""}
        {displayValue ?? formatMoney(amount)}
      </span>
    </div>
  )
);
CalculationLineRow.displayName = "CalculationLineRow";

export const CalculationTotalRow = memo(
  ({ amount, label }: { amount: number; label: string }) => (
    <div className="flex items-center justify-between gap-4 border-t pt-4 text-sm font-medium">
      <span>{label}</span>
      <span className="tabular-nums">{formatMoney(amount)}</span>
    </div>
  )
);
CalculationTotalRow.displayName = "CalculationTotalRow";
