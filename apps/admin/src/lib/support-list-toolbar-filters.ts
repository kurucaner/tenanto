import { type TDateRangePresetId } from "@/lib/date-range-presets";
import {
  buildLedgerToolbarDateClearOnePatch,
  buildLedgerToolbarDateFilterItem,
  type ILedgerToolbarDefaultDateRange,
} from "@/lib/ledger-toolbar-date-filters";
import {
  type SupportCategory,
  type SupportRequestStatus,
  type TSupportRequestsListSortBy,
  type TSupportRequestsListSortDir,
} from "@/packages/shared";

export type TSupportListToolbarFilterId = "category" | "date" | "q" | "status";

export interface ISupportListToolbarFilterItem {
  id: TSupportListToolbarFilterId;
  label: string;
}

type TSupportToolbarUrlKey =
  Exclude<TSupportListToolbarFilterId, "date"> | "allTime" | "from" | "to";

const CATEGORY_LABELS: Record<SupportCategory, string> = {
  bug: "Bug",
  feature: "Feature",
  general: "General",
};

const STATUS_LABELS: Record<SupportRequestStatus, string> = {
  in_progress: "In progress",
  pending: "Pending",
  resolved: "Resolved",
};

export function isSupportCategory(value: string): value is SupportCategory {
  return value === "bug" || value === "feature" || value === "general";
}

export function isSupportRequestStatus(value: string): value is SupportRequestStatus {
  return value === "pending" || value === "in_progress" || value === "resolved";
}

export function isSupportListSortBy(value: string): value is TSupportRequestsListSortBy {
  return (
    value === "category" || value === "createdAt" || value === "status" || value === "updatedAt"
  );
}

export function isSupportListSortDir(value: string): value is TSupportRequestsListSortDir {
  return value === "asc" || value === "desc";
}

export function countSupportSecondaryFilters(values: { category: string; status: string }): number {
  return Object.values(values).filter(Boolean).length;
}

export function buildSupportToolbarClearSecondaryPatch(): Partial<
  Record<"category" | "status", string>
> {
  return { category: "", status: "" };
}

export function buildSupportToolbarClearOnePatch(
  id: TSupportListToolbarFilterId,
  defaultDateRange: ILedgerToolbarDefaultDateRange
): Partial<Record<TSupportToolbarUrlKey, string>> {
  if (id === "date") {
    return buildLedgerToolbarDateClearOnePatch(defaultDateRange);
  }
  return { [id]: "" };
}

export function buildSupportToolbarClearAllPatch(
  defaultDateRange: ILedgerToolbarDefaultDateRange
): Record<TSupportToolbarUrlKey, string> {
  return {
    allTime: "",
    category: "",
    from: defaultDateRange.from,
    q: "",
    status: "",
    to: defaultDateRange.to,
  };
}

export function buildSupportListToolbarFilterItems(input: {
  activePreset: TDateRangePresetId | null;
  category: string;
  dateSummary: string;
  isDefaultDateRange: boolean;
  q: string;
  status: string;
}): ISupportListToolbarFilterItem[] {
  const items: ISupportListToolbarFilterItem[] = [];

  const dateItem = buildLedgerToolbarDateFilterItem({
    activePreset: input.activePreset,
    dateSummary: input.dateSummary,
    isDefaultDateRange: input.isDefaultDateRange,
  });
  if (dateItem) {
    items.push(dateItem);
  }

  const q = input.q.trim();
  if (q !== "") items.push({ id: "q", label: `Search: ${q}` });
  if (isSupportRequestStatus(input.status)) {
    items.push({ id: "status", label: `Status: ${STATUS_LABELS[input.status]}` });
  }
  if (isSupportCategory(input.category)) {
    items.push({ id: "category", label: `Category: ${CATEGORY_LABELS[input.category]}` });
  }
  return items;
}

export function formatSupportListCountLabel(loadedCount: number, hasNextPage: boolean): string {
  const noun = loadedCount === 1 ? "request" : "requests";
  return `${loadedCount}${hasNextPage ? "+" : ""} ${noun}`;
}
