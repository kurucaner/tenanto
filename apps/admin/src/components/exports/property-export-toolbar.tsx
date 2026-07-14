import { SlidersHorizontal } from "lucide-react";
import { memo } from "react";

import {
  DataTableActiveFilters,
  type IDataTableActiveFilter,
} from "@/components/data-table/data-table-active-filters";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { DateRangeFilterPanel } from "@/components/filters/date-range-filter-panel";
import { FilterSelectField } from "@/components/filters/filter-select-field";
import { ResponsiveFilterPanel } from "@/components/filters/responsive-filter-panel";
import { SearchFilterField } from "@/components/filters/search-filter-field";
import { Button } from "@/components/ui/button";
import { type TDateRangePresetId } from "@/lib/date-range-presets";
import {
  EXPORT_RESOURCE_FILTER_OPTIONS,
  type IExportToolbarFilterItem,
} from "@/lib/export-toolbar-filters";

interface PropertyExportToolbarProps {
  activeFilterCount: number;
  activeFilterItems: IExportToolbarFilterItem[];
  activePreset: TDateRangePresetId | null;
  countLabel?: string;
  from: string;
  onClearAll: () => void;
  onClearSecondaryFilters: () => void;
  onFilterChange: (key: "resourceType", value: string) => void;
  onFromChange: (value: string) => void;
  onPresetChange: (presetId: TDateRangePresetId) => void;
  onRemoveFilter: (id: IExportToolbarFilterItem["id"]) => void;
  onSearchInputChange: (value: string) => void;
  onToChange: (value: string) => void;
  resourceType: string;
  searchInput: string;
  to: string;
}

export const PropertyExportToolbar = memo(
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
    resourceType,
    searchInput,
    to,
  }: PropertyExportToolbarProps) => {
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
              idPrefix="export-filter"
              onFromChange={onFromChange}
              onPresetChange={onPresetChange}
              onToChange={onToChange}
              to={to}
            />
            <ResponsiveFilterPanel
              description="Filter exports by resource type."
              title="Export filters"
              trigger={
                <Button type="button" variant="outline">
                  <SlidersHorizontal />
                  Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                </Button>
              }
            >
              <div className="space-y-3">
                <FilterSelectField
                  id="export-filter-resource"
                  label="Resource"
                  onChange={(event) => onFilterChange("resourceType", event.target.value)}
                  options={EXPORT_RESOURCE_FILTER_OPTIONS}
                  value={resourceType}
                />
                <div className="flex justify-end">
                  <Button
                    disabled={activeFilterCount === 0}
                    onClick={onClearSecondaryFilters}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Clear filters
                  </Button>
                </div>
              </div>
            </ResponsiveFilterPanel>
          </>
        }
        countLabel={countLabel}
        search={
          <SearchFilterField
            id="export-filter-search"
            onChange={onSearchInputChange}
            placeholder="Search by file name…"
            value={searchInput}
          />
        }
      />
    );
  }
);
PropertyExportToolbar.displayName = "PropertyExportToolbar";
