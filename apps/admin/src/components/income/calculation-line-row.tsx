import { memo } from "react";

import { formatMoney } from "@/lib/format-money";
import { cn } from "@/lib/utils";
import { type IStayCalculationLine } from "@/packages/shared";

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
    <div
      className={cn(
        "flex items-start justify-between gap-4 text-sm",
        getEmphasisClassName(emphasis)
      )}
    >
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

function renderCalculationLine(line: IStayCalculationLine, key: string) {
  if (line.emphasis === "total") {
    return null;
  }

  return (
    <CalculationLineRow
      amount={line.amount}
      displayValue={line.displayValue}
      emphasis={line.emphasis}
      key={key}
      label={line.label}
      note={line.note}
      sign={line.sign}
    />
  );
}

export const CalculationBreakdownSections = memo(
  ({
    baseLines,
    detailLines,
  }: {
    baseLines: IStayCalculationLine[];
    detailLines: IStayCalculationLine[];
  }) => (
    <div className="flex flex-col gap-2">
      {baseLines.length > 0 ? (
        <div className="flex flex-col gap-2 pb-2">
          {baseLines.map((line, index) =>
            renderCalculationLine(line, `base-${line.label}-${index}`)
          )}
        </div>
      ) : null}
      {detailLines.map((line, index) =>
        renderCalculationLine(line, `detail-${line.label}-${index}`)
      )}
    </div>
  )
);
CalculationBreakdownSections.displayName = "CalculationBreakdownSections";

export const CalculationTotalRow = memo(({ amount, label }: { amount: number; label: string }) => (
  <div className="flex items-center justify-between gap-4 border-t pt-4 text-sm font-medium">
    <span>{label}</span>
    <span className="tabular-nums">{formatMoney(amount)}</span>
  </div>
));
CalculationTotalRow.displayName = "CalculationTotalRow";
