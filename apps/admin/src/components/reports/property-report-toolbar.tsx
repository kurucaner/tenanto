import { memo } from "react";

import {
  DataTableActiveFilters,
  type IDataTableActiveFilter,
} from "@/components/data-table/data-table-active-filters";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { DateRangeFilterPanel } from "@/components/filters/date-range-filter-panel";
import { ReportFilterPanel, type TReportFilterKey } from "@/components/reports/report-filter-panel";
import {
  BOUNDED_DATE_RANGE_PRESET_OPTIONS,
  type TDateRangePresetId,
} from "@/lib/date-range-presets";
import { type IReportToolbarFilterItem } from "@/lib/report-toolbar-filters";
import { type TSelectOption } from "@/lib/select-option-types";
import { type IPropertyUnit } from "@/packages/shared";

interface PropertyReportToolbarProps {
  activeFilterCount: number;
  activeFilterItems: IReportToolbarFilterItem[];
  activePreset: TDateRangePresetId | null;
  channelCommissionId: string;
  channelOptions: TSelectOption[];
  from: string;
  onClearAll: () => void;
  onClearSecondaryFilters: () => void;
  onFilterChange: (key: TReportFilterKey, value: string) => void;
  onFromChange: (value: string) => void;
  onPresetChange: (presetId: TDateRangePresetId) => void;
  onRemoveFilter: (id: IReportToolbarFilterItem["id"]) => void;
  onToChange: (value: string) => void;
  rentalType: string;
  rentalTypeNote?: string;
  to: string;
  unitId: string;
  units: IPropertyUnit[];
}

export const PropertyReportToolbar = memo(
  ({
    activeFilterCount,
    activeFilterItems,
    activePreset,
    channelCommissionId,
    channelOptions,
    from,
    onClearAll,
    onClearSecondaryFilters,
    onFilterChange,
    onFromChange,
    onPresetChange,
    onRemoveFilter,
    onToChange,
    rentalType,
    rentalTypeNote,
    to,
    unitId,
    units,
  }: PropertyReportToolbarProps) => {
    const activeFilters: IDataTableActiveFilter[] = activeFilterItems.map((item) => ({
      id: item.id,
      label: item.label,
      onRemove: () => onRemoveFilter(item.id),
    }));

    return (
      <div className="space-y-2">
        <DataTableToolbar
          activeFilters={<DataTableActiveFilters filters={activeFilters} onClearAll={onClearAll} />}
          controls={
            <>
              <DateRangeFilterPanel
                activePreset={activePreset}
                from={from}
                idPrefix="report-filter"
                onFromChange={onFromChange}
                onPresetChange={onPresetChange}
                onToChange={onToChange}
                presets={BOUNDED_DATE_RANGE_PRESET_OPTIONS}
                to={to}
              />
              <ReportFilterPanel
                activeFilterCount={activeFilterCount}
                channelCommissionId={channelCommissionId}
                channelOptions={channelOptions}
                onClear={onClearSecondaryFilters}
                onFilterChange={onFilterChange}
                rentalType={rentalType}
                unitId={unitId}
                units={units}
              />
            </>
          }
          controlsClassName="ml-auto"
        />
        {rentalTypeNote ? (
          <p className="px-3 text-muted-foreground text-xs">{rentalTypeNote}</p>
        ) : null}
      </div>
    );
  }
);
PropertyReportToolbar.displayName = "PropertyReportToolbar";
