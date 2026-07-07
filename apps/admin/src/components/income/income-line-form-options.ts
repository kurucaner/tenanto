import { cn } from "@/lib/utils";
import { IncomeEntryKind, type IPropertyIncomeLineType } from "@/packages/shared";

export const incomeLineSelectClassName = cn(
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "dark:bg-input/30"
);

export interface IncomeLineTypeOption {
  label: string;
  value: string;
}

export function buildIncomeLineTypeOptions(
  types: Pick<IPropertyIncomeLineType, "id" | "name">[]
): IncomeLineTypeOption[] {
  return types.map((type) => ({ label: type.name, value: type.id }));
}

export function buildIncomeTypeFilterOptions(
  types: Pick<IPropertyIncomeLineType, "id" | "name">[]
): { label: string; value: string }[] {
  return [
    { label: "All types", value: "" },
    { label: "Stay", value: IncomeEntryKind.STAY },
    ...buildIncomeLineTypeOptions(types),
  ];
}

export function formatIncomeLineTypeLabel(
  incomeLineTypeId: string,
  types: Pick<IPropertyIncomeLineType, "id" | "name">[]
): string {
  return types.find((type) => type.id === incomeLineTypeId)?.name ?? incomeLineTypeId;
}
