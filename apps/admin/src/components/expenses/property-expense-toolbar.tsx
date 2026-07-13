import { memo } from "react";

import {
  DataTableActiveFilters,
  type IDataTableActiveFilter,
} from "@/components/data-table/data-table-active-filters";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import {
  ExpenseFilterPanel,
  type TExpenseFilterKey,
} from "@/components/expenses/expense-filter-panel";
import { DateRangeFilterPanel } from "@/components/filters/date-range-filter-panel";
import { SearchFilterField } from "@/components/filters/search-filter-field";
import { type TDateRangePresetId } from "@/lib/date-range-presets";
import { type IExpenseToolbarFilterItem } from "@/lib/expense-toolbar-filters";
import { type TSelectOption } from "@/lib/select-option-types";

interface PropertyExpenseToolbarProps {
  activeFilterCount: number;
  activeFilterItems: IExpenseToolbarFilterItem[];
  activePreset: TDateRangePresetId | null;
  categoryFilterOptions: TSelectOption[];
  categoryId: string;
  countLabel?: string;
  from: string;
  onClearAll: () => void;
  onClearSecondaryFilters: () => void;
  onFilterChange: (key: TExpenseFilterKey, value: string) => void;
  onFromChange: (value: string) => void;
  onPresetChange: (presetId: TDateRangePresetId) => void;
  onRemoveFilter: (id: IExpenseToolbarFilterItem["id"]) => void;
  onSearchInputChange: (value: string) => void;
  onToChange: (value: string) => void;
  searchInput: string;
  to: string;
}

export const PropertyExpenseToolbar = memo(
  ({
    activeFilterCount,
    activeFilterItems,
    activePreset,
    categoryFilterOptions,
    categoryId,
    countLabel,
    from,
    onClearAll,
    onClearSecondaryFilters,
    onFilterChange,
    onFromChange,
    onPresetChange,
    onRemoveFilter,
    onSearchInputChange,
    onToChange,
    searchInput,
    to,
  }: PropertyExpenseToolbarProps) => {
    const activeFilters: IDataTableActiveFilter[] = activeFilterItems.map((item) => ({
      id: item.id,
      label: item.label,
      onRemove: () => onRemoveFilter(item.id),
    }));

    return (
      <DataTableToolbar
        activeFilters={
          <DataTableActiveFilters filters={activeFilters} onClearAll={onClearAll} />
        }
        controls={
          <>
            <DateRangeFilterPanel
              activePreset={activePreset}
              from={from}
              idPrefix="expense-filter"
              onFromChange={onFromChange}
              onPresetChange={onPresetChange}
              onToChange={onToChange}
              to={to}
            />
            <ExpenseFilterPanel
              activeFilterCount={activeFilterCount}
              categoryFilterOptions={categoryFilterOptions}
              categoryId={categoryId}
              onClear={onClearSecondaryFilters}
              onFilterChange={onFilterChange}
            />
          </>
        }
        countLabel={countLabel}
        search={
          <SearchFilterField
            id="expense-filter-search"
            onChange={onSearchInputChange}
            placeholder="Search description or category…"
            value={searchInput}
          />
        }
      />
    );
  }
);
PropertyExpenseToolbar.displayName = "PropertyExpenseToolbar";
