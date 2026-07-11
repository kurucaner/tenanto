import { IncomeEntryKind, type IPropertyIncomeLineType } from "@/packages/shared";

export { nativeSelectClassName as incomeLineSelectClassName } from "@/lib/native-select-class-name";

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
