import { memo } from "react";

import { RefetchButton } from "@/components/data/refetch-button";
import {
  DataTableActiveFilters,
  type IDataTableActiveFilter,
} from "@/components/data-table/data-table-active-filters";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { DateRangeFilterPanel } from "@/components/filters/date-range-filter-panel";
import { SearchFilterField } from "@/components/filters/search-filter-field";
import {
  SupportFilterPanel,
  type TSupportFilterKey,
} from "@/components/support/support-filter-panel";
import { type TDateRangePresetId } from "@/lib/date-range-presets";
import { type ISupportListToolbarFilterItem } from "@/lib/support-list-toolbar-filters";

interface ISupportRequestsToolbarProps {
  activeFilterCount: number;
  activeFilterItems: ISupportListToolbarFilterItem[];
  activePreset: TDateRangePresetId | null;
  category: string;
  countLabel?: string;
  from: string;
  isRefetching: boolean;
  onClearAll: () => void;
  onClearSecondaryFilters: () => void;
  onFilterChange: (key: TSupportFilterKey, value: string) => void;
  onFromChange: (value: string) => void;
  onPresetChange: (presetId: TDateRangePresetId) => void;
  onRefetch: () => void;
  onRemoveFilter: (id: ISupportListToolbarFilterItem["id"]) => void;
  onSearchInputChange: (value: string) => void;
  onToChange: (value: string) => void;
  searchInput: string;
  searchPlaceholder: string;
  status: string;
  to: string;
}

export const SupportRequestsToolbar = memo(
  ({
    activeFilterCount,
    activeFilterItems,
    activePreset,
    category,
    countLabel,
    from,
    isRefetching,
    onClearAll,
    onClearSecondaryFilters,
    onFilterChange,
    onFromChange,
    onPresetChange,
    onRefetch,
    onRemoveFilter,
    onSearchInputChange,
    onToChange,
    searchInput,
    searchPlaceholder,
    status,
    to,
  }: ISupportRequestsToolbarProps) => {
    const activeFilters: IDataTableActiveFilter[] = activeFilterItems.map((item) => ({
      id: item.id,
      label: item.label,
      onRemove: () => onRemoveFilter(item.id),
    }));

    return (
      <DataTableToolbar
        activeFilters={<DataTableActiveFilters filters={activeFilters} onClearAll={onClearAll} />}
        controls={
          <>
            <DateRangeFilterPanel
              activePreset={activePreset}
              from={from}
              idPrefix="support-filter"
              onFromChange={onFromChange}
              onPresetChange={onPresetChange}
              onToChange={onToChange}
              to={to}
            />
            <SupportFilterPanel
              activeFilterCount={activeFilterCount}
              category={category}
              onClear={onClearSecondaryFilters}
              onFilterChange={onFilterChange}
              status={status}
            />
            <RefetchButton isRefetching={isRefetching} onRefetch={onRefetch} />
          </>
        }
        countLabel={countLabel}
        search={
          <SearchFilterField
            id="support-list-search"
            onChange={onSearchInputChange}
            placeholder={searchPlaceholder}
            value={searchInput}
          />
        }
      />
    );
  }
);
SupportRequestsToolbar.displayName = "SupportRequestsToolbar";
