import { memo } from "react";

import {
  DataTableActiveFilters,
  type IDataTableActiveFilter,
} from "@/components/data-table/data-table-active-filters";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { SearchFilterField } from "@/components/filters/search-filter-field";
import { type IPropertiesListToolbarFilterItem } from "@/lib/properties-list-toolbar-filters";

interface PropertiesListToolbarProps {
  activeFilterItems: IPropertiesListToolbarFilterItem[];
  countLabel?: string;
  onClearAll: () => void;
  onRemoveFilter: (id: IPropertiesListToolbarFilterItem["id"]) => void;
  onSearchInputChange: (value: string) => void;
  searchInput: string;
}

export const PropertiesListToolbar = memo(
  ({
    activeFilterItems,
    countLabel,
    onClearAll,
    onRemoveFilter,
    onSearchInputChange,
    searchInput,
  }: PropertiesListToolbarProps) => {
    const activeFilters: IDataTableActiveFilter[] = activeFilterItems.map((item) => ({
      id: item.id,
      label: item.label,
      onRemove: () => onRemoveFilter(item.id),
    }));

    return (
      <DataTableToolbar
        activeFilters={
          activeFilters.length > 0 ? (
            <DataTableActiveFilters filters={activeFilters} onClearAll={onClearAll} />
          ) : undefined
        }
        countLabel={countLabel}
        search={
          <SearchFilterField
            id="properties-list-search"
            onChange={onSearchInputChange}
            placeholder="Search by name or address…"
            value={searchInput}
          />
        }
      />
    );
  }
);
PropertiesListToolbar.displayName = "PropertiesListToolbar";
