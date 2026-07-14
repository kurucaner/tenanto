import { type TDateRangePresetId } from "@/lib/date-range-presets";
import {
  buildLedgerToolbarDateClearOnePatch,
  buildLedgerToolbarDateFilterItem,
  type ILedgerToolbarDefaultDateRange,
} from "@/lib/ledger-toolbar-date-filters";
import { type TSelectOption } from "@/lib/select-option-types";

export type TUnitToolbarFilterId = "date" | "occupancy" | "q" | "rentalType";

export interface IUnitToolbarFilterItem {
  id: TUnitToolbarFilterId;
  label: string;
}

type TUnitToolbarUrlKey = Exclude<TUnitToolbarFilterId, "date"> | "allTime" | "from" | "to";

function findOptionLabel(options: readonly TSelectOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function countUnitSecondaryFilters(values: {
  occupancy: string;
  rentalType: string;
}): number {
  return Object.values(values).filter(Boolean).length;
}

export function buildUnitToolbarClearOnePatch(
  id: TUnitToolbarFilterId,
  defaultDateRange: ILedgerToolbarDefaultDateRange
): Partial<Record<TUnitToolbarUrlKey, string>> {
  if (id === "date") {
    return buildLedgerToolbarDateClearOnePatch(defaultDateRange);
  }
  return { [id]: "" };
}

export function buildUnitToolbarClearAllPatch(
  defaultDateRange: ILedgerToolbarDefaultDateRange
): Record<TUnitToolbarUrlKey, string> {
  return {
    allTime: "true",
    from: defaultDateRange.from,
    occupancy: "",
    q: "",
    rentalType: "",
    to: defaultDateRange.to,
  };
}

export function buildUnitToolbarFilterItems(input: {
  activePreset: TDateRangePresetId | null;
  allTime: boolean;
  dateSummary: string;
  occupancy: string;
  occupancyOptions: readonly TSelectOption[];
  q: string;
  rentalType: string;
  rentalTypeOptions: readonly TSelectOption[];
}): IUnitToolbarFilterItem[] {
  const items: IUnitToolbarFilterItem[] = [];

  if (!input.allTime) {
    const dateItem = buildLedgerToolbarDateFilterItem({
      activePreset: input.activePreset,
      dateSummary: input.dateSummary,
      isDefaultDateRange: false,
    });
    if (dateItem) {
      items.push(dateItem);
    }
  }
  if (input.rentalType) {
    items.push({
      id: "rentalType",
      label: `Type: ${findOptionLabel(input.rentalTypeOptions, input.rentalType)}`,
    });
  }
  if (input.occupancy) {
    items.push({
      id: "occupancy",
      label: `Occupancy: ${findOptionLabel(input.occupancyOptions, input.occupancy)}`,
    });
  }
  const trimmedQuery = input.q.trim();
  if (trimmedQuery) {
    items.push({ id: "q", label: `Search: ${trimmedQuery}` });
  }

  return items;
}
