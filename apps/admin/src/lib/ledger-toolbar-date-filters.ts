import { DateRangePreset, type TDateRangePresetId } from "@/lib/date-range-presets";

export interface ILedgerToolbarDefaultDateRange {
  from: string;
  to: string;
}

export interface ILedgerToolbarDateFilterItem {
  id: "date";
  label: string;
}

export function buildLedgerToolbarDateFilterItem(input: {
  activePreset: TDateRangePresetId | null;
  dateSummary: string;
  isDefaultDateRange: boolean;
}): ILedgerToolbarDateFilterItem | null {
  if (!input.isDefaultDateRange || input.activePreset === DateRangePreset.ALL) {
    return { id: "date", label: `Date: ${input.dateSummary}` };
  }
  return null;
}

export function buildLedgerToolbarDateClearOnePatch(
  defaultDateRange: ILedgerToolbarDefaultDateRange
): { allTime: string; from: string; to: string } {
  return { allTime: "", from: defaultDateRange.from, to: defaultDateRange.to };
}
