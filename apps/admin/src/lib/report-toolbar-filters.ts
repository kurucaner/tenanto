import { type TDateRangePresetId } from "@/lib/date-range-presets";
import {
  buildLedgerToolbarDateClearOnePatch,
  buildLedgerToolbarDateFilterItem,
  type ILedgerToolbarDefaultDateRange,
} from "@/lib/ledger-toolbar-date-filters";
import { type TSelectOption } from "@/lib/select-option-types";

export type TReportToolbarFilterId = "channelCommissionId" | "date" | "rentalType" | "unitId";

export interface IReportToolbarFilterItem {
  id: TReportToolbarFilterId;
  label: string;
}

type TReportToolbarUrlKey = Exclude<TReportToolbarFilterId, "date"> | "allTime" | "from" | "to";

function findOptionLabel(options: readonly TSelectOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function countReportSecondaryFilters(values: {
  channelCommissionId: string;
  rentalType: string;
  unitId: string;
}): number {
  return Object.values(values).filter(Boolean).length;
}

export function buildReportToolbarClearOnePatch(
  id: TReportToolbarFilterId,
  defaultDateRange: ILedgerToolbarDefaultDateRange
): Partial<Record<TReportToolbarUrlKey, string>> {
  if (id === "date") {
    return buildLedgerToolbarDateClearOnePatch(defaultDateRange);
  }
  return { [id]: "" };
}

export function buildReportToolbarClearAllPatch(
  defaultDateRange: ILedgerToolbarDefaultDateRange
): Record<TReportToolbarUrlKey, string> {
  return {
    allTime: "",
    channelCommissionId: "",
    from: defaultDateRange.from,
    rentalType: "",
    to: defaultDateRange.to,
    unitId: "",
  };
}

export function buildReportToolbarFilterItems(input: {
  activePreset: TDateRangePresetId | null;
  channelCommissionId: string;
  channelOptions: readonly TSelectOption[];
  dateSummary: string;
  isDefaultDateRange: boolean;
  rentalType: string;
  rentalTypeOptions: readonly TSelectOption[];
  unitId: string;
  unitOptions: readonly TSelectOption[];
}): IReportToolbarFilterItem[] {
  const items: IReportToolbarFilterItem[] = [];

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
  if (input.channelCommissionId) {
    items.push({
      id: "channelCommissionId",
      label: `Channel: ${findOptionLabel(input.channelOptions, input.channelCommissionId)}`,
    });
  }
  if (input.rentalType) {
    items.push({
      id: "rentalType",
      label: `Rental type: ${findOptionLabel(input.rentalTypeOptions, input.rentalType)}`,
    });
  }

  return items;
}
