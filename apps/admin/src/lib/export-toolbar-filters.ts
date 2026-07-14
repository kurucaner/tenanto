import { type TDateRangePresetId } from "@/lib/date-range-presets";
import {
  buildLedgerToolbarDateClearOnePatch,
  buildLedgerToolbarDateFilterItem,
  type ILedgerToolbarDefaultDateRange,
} from "@/lib/ledger-toolbar-date-filters";
import { type TSelectOption } from "@/lib/select-option-types";
import { ExportResourceType } from "@/packages/shared";

export type TExportToolbarFilterId = "date" | "resourceType";

export interface IExportToolbarFilterItem {
  id: TExportToolbarFilterId;
  label: string;
}

type TExportToolbarUrlKey =
  Exclude<TExportToolbarFilterId, "date"> | "allTime" | "from" | "q" | "to";

export const EXPORT_RESOURCE_FILTER_OPTIONS: readonly TSelectOption[] = [
  { label: "All resources", value: "" },
  { label: "Expenses", value: ExportResourceType.EXPENSES },
  { label: "Income", value: ExportResourceType.INCOME },
  { label: "Leases", value: ExportResourceType.LEASES },
];

function findOptionLabel(options: readonly TSelectOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function countExportSecondaryFilters(values: { resourceType: string }): number {
  return Object.values(values).filter(Boolean).length;
}

export function buildExportToolbarClearOnePatch(
  id: TExportToolbarFilterId,
  defaultDateRange: ILedgerToolbarDefaultDateRange
): Partial<Record<TExportToolbarUrlKey, string>> {
  if (id === "date") {
    return buildLedgerToolbarDateClearOnePatch(defaultDateRange);
  }
  return { [id]: "" };
}

export function buildExportToolbarClearAllPatch(
  defaultDateRange: ILedgerToolbarDefaultDateRange
): Record<TExportToolbarUrlKey, string> {
  return {
    allTime: "true",
    from: defaultDateRange.from,
    q: "",
    resourceType: "",
    to: defaultDateRange.to,
  };
}

export function buildExportToolbarFilterItems(input: {
  activePreset: TDateRangePresetId | null;
  allTime: boolean;
  dateSummary: string;
  resourceType: string;
}): IExportToolbarFilterItem[] {
  const items: IExportToolbarFilterItem[] = [];

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

  if (input.resourceType) {
    items.push({
      id: "resourceType",
      label: `Resource: ${findOptionLabel(EXPORT_RESOURCE_FILTER_OPTIONS, input.resourceType)}`,
    });
  }

  return items;
}
