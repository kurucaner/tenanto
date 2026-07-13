import { memo } from "react";

import { DataTableFilterChip } from "@/components/data-table/data-table-filter-chip";
import { Button } from "@/components/ui/button";

export interface IDataTableActiveFilter {
  id: string;
  label: string;
  onRemove: () => void;
}

interface DataTableActiveFiltersProps {
  filters: IDataTableActiveFilter[];
  onClearAll: () => void;
}

export const DataTableActiveFilters = memo(
  ({ filters, onClearAll }: DataTableActiveFiltersProps) =>
    filters.length > 0 ? (
      <div className="flex flex-wrap items-center gap-1.5">
        {filters.map((filter) => (
          <DataTableFilterChip
            key={filter.id}
            label={filter.label}
            onRemove={filter.onRemove}
          />
        ))}
        <Button className="h-5 px-1.5 text-xs" onClick={onClearAll} type="button" variant="ghost">
          Clear all
        </Button>
      </div>
    ) : null
);
DataTableActiveFilters.displayName = "DataTableActiveFilters";
