import { memo } from "react";

import {
  DataTableActiveFilters,
  type IDataTableActiveFilter,
} from "@/components/data-table/data-table-active-filters";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { DateRangeFilterPanel } from "@/components/filters/date-range-filter-panel";
import { SearchFilterField } from "@/components/filters/search-filter-field";
import { LeaseFilterPanel, type TLeaseFilterKey } from "@/components/leases/lease-filter-panel";
import { type TDateRangePresetId } from "@/lib/date-range-presets";
import { type ILeaseToolbarFilterItem } from "@/lib/lease-toolbar-filters";
import { type TSelectOption } from "@/lib/select-option-types";
import { type IPropertyUnit } from "@/packages/shared";

interface PropertyLeaseToolbarProps {
  activeFilterCount: number;
  activeFilterItems: ILeaseToolbarFilterItem[];
  activePreset: TDateRangePresetId | null;
  countLabel?: string;
  from: string;
  onClearAll: () => void;
  onClearSecondaryFilters: () => void;
  onFilterChange: (key: TLeaseFilterKey, value: string) => void;
  onFromChange: (value: string) => void;
  onPresetChange: (presetId: TDateRangePresetId) => void;
  onRemoveFilter: (id: ILeaseToolbarFilterItem["id"]) => void;
  onSearchInputChange: (value: string) => void;
  onToChange: (value: string) => void;
  searchInput: string;
  status: string;
  statusOptions: readonly TSelectOption[];
  to: string;
  unitId: string;
  units: IPropertyUnit[];
}

export const PropertyLeaseToolbar = memo(
  ({
    activeFilterCount,
    activeFilterItems,
    activePreset,
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
    status,
    statusOptions,
    to,
    unitId,
    units,
  }: PropertyLeaseToolbarProps) => {
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
              idPrefix="lease-filter"
              onFromChange={onFromChange}
              onPresetChange={onPresetChange}
              onToChange={onToChange}
              to={to}
            />
            <LeaseFilterPanel
              activeFilterCount={activeFilterCount}
              onClear={onClearSecondaryFilters}
              onFilterChange={onFilterChange}
              status={status}
              statusOptions={statusOptions}
              unitId={unitId}
              units={units}
            />
          </>
        }
        countLabel={countLabel}
        search={
          <SearchFilterField
            id="lease-filter-search"
            onChange={onSearchInputChange}
            placeholder="Search tenant, email, or unit…"
            value={searchInput}
          />
        }
      />
    );
  }
);
PropertyLeaseToolbar.displayName = "PropertyLeaseToolbar";
