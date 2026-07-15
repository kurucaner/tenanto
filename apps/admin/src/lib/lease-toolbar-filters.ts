import { type TDateRangePresetId } from "@/lib/date-range-presets";
import {
  buildLedgerToolbarDateClearOnePatch,
  buildLedgerToolbarDateFilterItem,
  type ILedgerToolbarDefaultDateRange,
} from "@/lib/ledger-toolbar-date-filters";
import { type TSelectOption } from "@/lib/select-option-types";
import { PropertyLongStayStatus } from "@/packages/shared";

export type TLeaseToolbarFilterId = "date" | "q" | "status" | "unitId";

export const LEASE_STATUS_FILTER_ALL = "all";

export const DEFAULT_LEASE_STATUS_FILTER = PropertyLongStayStatus.ACTIVE;

export const LEASE_STATUS_FILTER_OPTIONS: readonly TSelectOption[] = [
  { label: "All leases", value: LEASE_STATUS_FILTER_ALL },
  { label: "Active", value: PropertyLongStayStatus.ACTIVE },
  { label: "Ended", value: PropertyLongStayStatus.ENDED },
];

export interface ILeaseToolbarFilterItem {
  id: TLeaseToolbarFilterId;
  label: string;
}

type TLeaseToolbarUrlKey = Exclude<TLeaseToolbarFilterId, "date"> | "allTime" | "from" | "to";

function findOptionLabel(options: readonly TSelectOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function countLeaseSecondaryFilters(values: { status: string; unitId: string }): number {
  let count = 0;
  if (values.unitId) {
    count += 1;
  }
  if (values.status === LEASE_STATUS_FILTER_ALL || values.status === PropertyLongStayStatus.ENDED) {
    count += 1;
  }
  return count;
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
    allTime: "true",
    from: defaultDateRange.from,
    q: "",
    status: DEFAULT_LEASE_STATUS_FILTER,
    to: defaultDateRange.to,
    unitId: "",
  };
}

export function buildLeaseToolbarFilterItems(input: {
  activePreset: TDateRangePresetId | null;
  allTime: boolean;
  dateSummary: string;
  q: string;
  status: string;
  statusOptions: readonly TSelectOption[];
  unitId: string;
  unitOptions: readonly TSelectOption[];
}): ILeaseToolbarFilterItem[] {
  const items: ILeaseToolbarFilterItem[] = [];

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
  if (input.unitId) {
    items.push({
      id: "unitId",
      label: `Unit: ${findOptionLabel(input.unitOptions, input.unitId)}`,
    });
  }
  if (input.status === LEASE_STATUS_FILTER_ALL || input.status === PropertyLongStayStatus.ENDED) {
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
