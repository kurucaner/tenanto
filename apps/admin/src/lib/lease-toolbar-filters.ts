import { type TDateRangePresetId } from "@/lib/date-range-presets";
import {
  buildLedgerToolbarDateClearOnePatch,
  buildLedgerToolbarDateFilterItem,
  type ILedgerToolbarDefaultDateRange,
} from "@/lib/ledger-toolbar-date-filters";
import { type TSelectOption } from "@/lib/select-option-types";

export type TLeaseToolbarFilterId = "date" | "q" | "status" | "unitId";

export interface ILeaseToolbarFilterItem {
  id: TLeaseToolbarFilterId;
  label: string;
}

type TLeaseToolbarUrlKey =
  | Exclude<TLeaseToolbarFilterId, "date">
  | "allTime"
  | "from"
  | "to";

function findOptionLabel(options: readonly TSelectOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function countLeaseSecondaryFilters(values: { status: string; unitId: string }): number {
  return Object.values(values).filter(Boolean).length;
}

export function buildLeaseToolbarClearOnePatch(
  id: TLeaseToolbarFilterId,
  defaultDateRange: ILedgerToolbarDefaultDateRange
): Partial<Record<TLeaseToolbarUrlKey, string>> {
  if (id === "date") {
    return buildLedgerToolbarDateClearOnePatch(defaultDateRange);
  }
  return { [id]: "" };
}

export function buildLeaseToolbarClearAllPatch(
  defaultDateRange: ILedgerToolbarDefaultDateRange
): Record<TLeaseToolbarUrlKey, string> {
  return {
    allTime: "",
    from: defaultDateRange.from,
    q: "",
    status: "",
    to: defaultDateRange.to,
    unitId: "",
  };
}

export function buildLeaseToolbarFilterItems(input: {
  activePreset: TDateRangePresetId | null;
  dateSummary: string;
  isDefaultDateRange: boolean;
  q: string;
  status: string;
  statusOptions: readonly TSelectOption[];
  unitId: string;
  unitOptions: readonly TSelectOption[];
}): ILeaseToolbarFilterItem[] {
  const items: ILeaseToolbarFilterItem[] = [];

  const dateItem = buildLedgerToolbarDateFilterItem({
    activePreset: input.activePreset,
    dateSummary: input.dateSummary,
    isDefaultDateRange: input.isDefaultDateRange,
  });
  if (dateItem) {
    items.push(dateItem);
  }
  if (input.unitId) {
    items.push({
      id: "unitId",
      label: `Unit: ${findOptionLabel(input.unitOptions, input.unitId)}`,
    });
  }
  if (input.status) {
    items.push({
      id: "status",
      label: `Status: ${findOptionLabel(input.statusOptions, input.status)}`,
    });
  }
  const trimmedQuery = input.q.trim();
  if (trimmedQuery) {
    items.push({ id: "q", label: `Search: ${trimmedQuery}` });
  }

  return items;
}
