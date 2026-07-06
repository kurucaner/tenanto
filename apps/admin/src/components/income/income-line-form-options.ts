import { cn } from "@/lib/utils";
import { IncomeEntryKind, IncomeLineType, type TIncomeLineType } from "@/packages/shared";

export const incomeLineSelectClassName = cn(
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "dark:bg-input/30"
);

export const INCOME_LINE_TYPE_OPTIONS: { label: string; value: TIncomeLineType }[] = [
  { label: "Cleaning only", value: IncomeLineType.CLEANING_ONLY },
  { label: "Extra cleaning", value: IncomeLineType.EXTRA_CLEANING },
  { label: "Extra service", value: IncomeLineType.EXTRA_SERVICE },
  { label: "Beach equipment rental", value: IncomeLineType.BEACH_EQUIPMENT_RENTAL },
];

export const INCOME_TYPE_FILTER_OPTIONS = [
  { label: "All types", value: "" },
  { label: "Stay", value: IncomeEntryKind.STAY },
  ...INCOME_LINE_TYPE_OPTIONS.map((opt) => ({ label: opt.label, value: opt.value })),
];

export function formatIncomeLineTypeLabel(lineType: TIncomeLineType): string {
  return INCOME_LINE_TYPE_OPTIONS.find((opt) => opt.value === lineType)?.label ?? lineType;
}
