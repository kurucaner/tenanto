import { type TDateRangePresetId } from "@/lib/date-range-presets";
import {
  buildLedgerToolbarDateClearOnePatch,
  buildLedgerToolbarDateFilterItem,
  type ILedgerToolbarDefaultDateRange,
} from "@/lib/ledger-toolbar-date-filters";
import { type TSelectOption } from "@/lib/select-option-types";

export type TIncomeToolbarFilterId =
  | "channelCommissionId"
  | "date"
  | "incomeType"
  | "refundStatus"
  | "status"
  | "unitId";

export interface IIncomeToolbarFilterItem {
  id: TIncomeToolbarFilterId;
  label: string;
}

type TIncomeToolbarUrlKey = Exclude<TIncomeToolbarFilterId, "date"> | "allTime" | "from" | "q" | "to";

function findOptionLabel(options: readonly TSelectOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function countIncomeSecondaryFilters(values: {
  channelCommissionId: string;
  incomeType: string;
  refundStatus: string;
  status: string;
  unitId: string;
}): number {
  return Object.values(values).filter(Boolean).length;
}

export function buildIncomeToolbarClearOnePatch(
  id: TIncomeToolbarFilterId,
  defaultDateRange: ILedgerToolbarDefaultDateRange
): Partial<Record<TIncomeToolbarUrlKey, string>> {
  if (id === "date") {
    return buildLedgerToolbarDateClearOnePatch(defaultDateRange);
  }
  return { [id]: "" };
}

export function buildIncomeToolbarClearAllPatch(
  defaultDateRange: ILedgerToolbarDefaultDateRange
): Record<TIncomeToolbarUrlKey, string> {
  return {
    allTime: "",
    channelCommissionId: "",
    from: defaultDateRange.from,
    incomeType: "",
    q: "",
    refundStatus: "",
    status: "",
    to: defaultDateRange.to,
    unitId: "",
  };
}

export function buildIncomeToolbarFilterItems(input: {
  activePreset: TDateRangePresetId | null;
  channelCommissionId: string;
  channelOptions: readonly TSelectOption[];
  dateSummary: string;
  incomeType: string;
  incomeTypeOptions: readonly TSelectOption[];
  isDefaultDateRange: boolean;
  refundStatus: string;
  refundStatusOptions: readonly TSelectOption[];
  status: string;
  statusOptions: readonly TSelectOption[];
  unitId: string;
  unitOptions: readonly TSelectOption[];
}): IIncomeToolbarFilterItem[] {
  const items: IIncomeToolbarFilterItem[] = [];

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
  if (input.incomeType) {
    items.push({
      id: "incomeType",
      label: `Type: ${findOptionLabel(input.incomeTypeOptions, input.incomeType)}`,
    });
  }
  if (input.channelCommissionId) {
    items.push({
      id: "channelCommissionId",
      label: `Channel: ${findOptionLabel(input.channelOptions, input.channelCommissionId)}`,
    });
  }
  if (input.status) {
    items.push({
      id: "status",
      label: `Status: ${findOptionLabel(input.statusOptions, input.status)}`,
    });
  }
  if (input.refundStatus) {
    items.push({
      id: "refundStatus",
      label: `Refund: ${findOptionLabel(input.refundStatusOptions, input.refundStatus)}`,
    });
  }

  return items;
}
