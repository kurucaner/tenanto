import { memo } from "react";

import {
  DataTableActiveFilters,
  type IDataTableActiveFilter,
} from "@/components/data-table/data-table-active-filters";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { DateRangeFilterPanel } from "@/components/filters/date-range-filter-panel";
import { SearchFilterField } from "@/components/filters/search-filter-field";
import { IncomeFilterPanel, type TIncomeFilterKey } from "@/components/income/income-filter-panel";
import { type TDateRangePresetId } from "@/lib/date-range-presets";
import { type IIncomeToolbarFilterItem } from "@/lib/income-toolbar-filters";
import { type TSelectOption } from "@/lib/select-option-types";
import { type IPropertyUnit } from "@/packages/shared";

interface PropertyIncomeToolbarProps {
  activeFilterCount: number;
  activeFilterItems: IIncomeToolbarFilterItem[];
  activePreset: TDateRangePresetId | null;
  channelCommissionId: string;
  channelFilterOptions: TSelectOption[];
  countLabel?: string;
  from: string;
  incomeType: string;
  incomeTypeFilterOptions: TSelectOption[];
  onClearAll: () => void;
  onClearSecondaryFilters: () => void;
  onFilterChange: (key: TIncomeFilterKey, value: string) => void;
  onFromChange: (value: string) => void;
  onPresetChange: (presetId: TDateRangePresetId) => void;
  onRemoveFilter: (id: IIncomeToolbarFilterItem["id"]) => void;
  onSearchInputChange: (value: string) => void;
  onToChange: (value: string) => void;
  refundStatus: string;
  refundStatusFilterOptions: TSelectOption[];
  searchInput: string;
  showStays: boolean;
  status: string;
  statusOptions: TSelectOption[];
  to: string;
  unitId: string;
  units: IPropertyUnit[];
}

export const PropertyIncomeToolbar = memo(
  ({
    activeFilterCount,
    activeFilterItems,
    activePreset,
    channelCommissionId,
    channelFilterOptions,
    countLabel,
    from,
    incomeType,
    incomeTypeFilterOptions,
    onClearAll,
    onClearSecondaryFilters,
    onFilterChange,
    onFromChange,
    onPresetChange,
    onRemoveFilter,
    onSearchInputChange,
    onToChange,
    refundStatus,
    refundStatusFilterOptions,
    searchInput,
    showStays,
    status,
    statusOptions,
    to,
    unitId,
    units,
  }: PropertyIncomeToolbarProps) => {
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
              idPrefix="income-filter"
              onFromChange={onFromChange}
              onPresetChange={onPresetChange}
              onToChange={onToChange}
              to={to}
            />
            <IncomeFilterPanel
              activeFilterCount={activeFilterCount}
              channelCommissionId={channelCommissionId}
              channelFilterOptions={channelFilterOptions}
              incomeType={incomeType}
              incomeTypeFilterOptions={incomeTypeFilterOptions}
              onClear={onClearSecondaryFilters}
              onFilterChange={onFilterChange}
              refundStatus={refundStatus}
              refundStatusFilterOptions={refundStatusFilterOptions}
              showStays={showStays}
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
            id="income-filter-search"
            onChange={onSearchInputChange}
            placeholder="Search guest, unit, channel, or description…"
            value={searchInput}
          />
        }
      />
    );
  }
);
PropertyIncomeToolbar.displayName = "PropertyIncomeToolbar";
