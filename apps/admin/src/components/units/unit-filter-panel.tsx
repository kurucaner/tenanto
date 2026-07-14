import { SlidersHorizontal } from "lucide-react";
import { memo } from "react";

import { FilterSelectField } from "@/components/filters/filter-select-field";
import { ResponsiveFilterPanel } from "@/components/filters/responsive-filter-panel";
import { Button } from "@/components/ui/button";
import { type TSelectOption } from "@/lib/select-option-types";

export type TUnitFilterKey = "occupancy" | "rentalType";

interface UnitFilterPanelProps {
  activeFilterCount: number;
  occupancy: string;
  occupancyOptions: readonly TSelectOption[];
  onClear: () => void;
  onFilterChange: (key: TUnitFilterKey, value: string) => void;
  rentalType: string;
  rentalTypeOptions: readonly TSelectOption[];
}

export const UnitFilterPanel = memo(
  ({
    activeFilterCount,
    occupancy,
    occupancyOptions,
    onClear,
    onFilterChange,
    rentalType,
    rentalTypeOptions,
  }: UnitFilterPanelProps) => (
    <ResponsiveFilterPanel
      description="Narrow units without leaving the table."
      title="Unit filters"
      trigger={
        <Button type="button" variant="outline">
          <SlidersHorizontal />
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </Button>
      }
    >
      <div className="space-y-3">
        <FilterSelectField
          emptyOptionLabel="All types"
          id="unit-filter-type"
          label="Type"
          onChange={(event) => onFilterChange("rentalType", event.target.value)}
          options={rentalTypeOptions}
          value={rentalType}
        />
        <FilterSelectField
          emptyOptionLabel="All occupancy"
          id="unit-filter-occupancy"
          label="Occupancy"
          onChange={(event) => onFilterChange("occupancy", event.target.value)}
          options={occupancyOptions}
          value={occupancy}
        />
        <div className="flex justify-end">
          <Button
            disabled={activeFilterCount === 0}
            onClick={onClear}
            size="sm"
            type="button"
            variant="ghost"
          >
            Clear filters
          </Button>
        </div>
      </div>
    </ResponsiveFilterPanel>
  )
);
UnitFilterPanel.displayName = "UnitFilterPanel";
