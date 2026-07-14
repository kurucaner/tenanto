import { memo } from "react";

import {
  DataTableActiveFilters,
  type IDataTableActiveFilter,
} from "@/components/data-table/data-table-active-filters";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { DateRangeFilterPanel } from "@/components/filters/date-range-filter-panel";
import { SearchFilterField } from "@/components/filters/search-filter-field";
import { type TUnitFilterKey, UnitFilterPanel } from "@/components/units/unit-filter-panel";
import { type TDateRangePresetId } from "@/lib/date-range-presets";
import { type TSelectOption } from "@/lib/select-option-types";
import { type IUnitToolbarFilterItem } from "@/lib/unit-toolbar-filters";

interface PropertyUnitToolbarProps {
  activeFilterCount: number;
  activeFilterItems: IUnitToolbarFilterItem[];
  activePreset: TDateRangePresetId | null;
  countLabel?: string;
  from: string;
  occupancy: string;
  occupancyOptions: readonly TSelectOption[];
  onClearAll: () => void;
  onClearSecondaryFilters: () => void;
  onFilterChange: (key: TUnitFilterKey, value: string) => void;
  onFromChange: (value: string) => void;
  onPresetChange: (presetId: TDateRangePresetId) => void;
  onRemoveFilter: (id: IUnitToolbarFilterItem["id"]) => void;
  onSearchInputChange: (value: string) => void;
  onToChange: (value: string) => void;
  rentalType: string;
  rentalTypeOptions: readonly TSelectOption[];
  searchInput: string;
  to: string;
}

export const PropertyUnitToolbar = memo(
  ({
    activeFilterCount,
    activeFilterItems,
    activePreset,
    countLabel,
    from,
    occupancy,
    occupancyOptions,
    onClearAll,
    onClearSecondaryFilters,
    onFilterChange,
    onFromChange,
    onPresetChange,
    onRemoveFilter,
    onSearchInputChange,
    onToChange,
    rentalType,
    rentalTypeOptions,
    searchInput,
    to,
  }: PropertyUnitToolbarProps) => {
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
              idPrefix="unit-filter"
              onFromChange={onFromChange}
              onPresetChange={onPresetChange}
              onToChange={onToChange}
              to={to}
            />
            <UnitFilterPanel
              activeFilterCount={activeFilterCount}
              occupancy={occupancy}
              occupancyOptions={occupancyOptions}
              onClear={onClearSecondaryFilters}
              onFilterChange={onFilterChange}
              rentalType={rentalType}
              rentalTypeOptions={rentalTypeOptions}
            />
          </>
        }
        countLabel={countLabel}
        search={
          <SearchFilterField
            id="unit-filter-search"
            onChange={onSearchInputChange}
            placeholder="Search unit or tenant…"
            value={searchInput}
          />
        }
      />
    );
  }
);
PropertyUnitToolbar.displayName = "PropertyUnitToolbar";
