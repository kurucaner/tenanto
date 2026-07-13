import { type TDateRangePresetId } from "@/lib/date-range-presets";
import {
  buildLedgerToolbarDateClearOnePatch,
  buildLedgerToolbarDateFilterItem,
  type ILedgerToolbarDefaultDateRange,
} from "@/lib/ledger-toolbar-date-filters";
import { type TSelectOption } from "@/lib/select-option-types";

export type TExpenseToolbarFilterId = "categoryId" | "date";

export interface IExpenseToolbarFilterItem {
  id: TExpenseToolbarFilterId;
  label: string;
}

type TExpenseToolbarUrlKey =
  Exclude<TExpenseToolbarFilterId, "date"> | "allTime" | "from" | "q" | "to";

function findOptionLabel(options: readonly TSelectOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function countExpenseSecondaryFilters(values: { categoryId: string }): number {
  return Object.values(values).filter(Boolean).length;
}

export function buildExpenseToolbarClearOnePatch(
  id: TExpenseToolbarFilterId,
  defaultDateRange: ILedgerToolbarDefaultDateRange
): Partial<Record<TExpenseToolbarUrlKey, string>> {
  if (id === "date") {
    return buildLedgerToolbarDateClearOnePatch(defaultDateRange);
  }
  return { [id]: "" };
}

export function buildExpenseToolbarClearAllPatch(
  defaultDateRange: ILedgerToolbarDefaultDateRange
): Record<TExpenseToolbarUrlKey, string> {
  return {
    allTime: "",
    categoryId: "",
    from: defaultDateRange.from,
    q: "",
    to: defaultDateRange.to,
  };
}

export function buildExpenseToolbarFilterItems(input: {
  activePreset: TDateRangePresetId | null;
  categoryId: string;
  categoryOptions: readonly TSelectOption[];
  dateSummary: string;
  isDefaultDateRange: boolean;
}): IExpenseToolbarFilterItem[] {
  const items: IExpenseToolbarFilterItem[] = [];

  const dateItem = buildLedgerToolbarDateFilterItem({
    activePreset: input.activePreset,
    dateSummary: input.dateSummary,
    isDefaultDateRange: input.isDefaultDateRange,
  });
  if (dateItem) {
    items.push(dateItem);
  }
  if (input.categoryId) {
    items.push({
      id: "categoryId",
      label: `Category: ${findOptionLabel(input.categoryOptions, input.categoryId)}`,
    });
  }

  return items;
}
