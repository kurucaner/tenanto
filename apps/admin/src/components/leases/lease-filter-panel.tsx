import { SlidersHorizontal } from "lucide-react";
import { memo } from "react";

import { FilterSelectField } from "@/components/filters/filter-select-field";
import { ResponsiveFilterPanel } from "@/components/filters/responsive-filter-panel";
import { Button } from "@/components/ui/button";
import { PropertyUnitSelectOptions } from "@/components/units/property-unit-select-options";
import { type TSelectOption } from "@/lib/select-option-types";
import { type IPropertyUnit } from "@/packages/shared";

export type TLeaseFilterKey = "status" | "unitId";

interface LeaseFilterPanelProps {
  activeFilterCount: number;
  onClear: () => void;
  onFilterChange: (key: TLeaseFilterKey, value: string) => void;
  status: string;
  statusOptions: readonly TSelectOption[];
  unitId: string;
  units: IPropertyUnit[];
}

export const LeaseFilterPanel = memo(
  ({
    activeFilterCount,
    onClear,
    onFilterChange,
    status,
    statusOptions,
    unitId,
    units,
  }: LeaseFilterPanelProps) => (
    <ResponsiveFilterPanel
      description="Narrow leases without leaving the table."
      title="Lease filters"
      trigger={
        <Button type="button" variant="outline">
          <SlidersHorizontal />
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </Button>
      }
    >
      <div className="space-y-3">
        <FilterSelectField
          id="lease-filter-status"
          label="Status"
          onChange={(event) => onFilterChange("status", event.target.value)}
          options={statusOptions}
          value={status}
        />
        <FilterSelectField
          emptyOptionLabel="All units"
          id="lease-filter-unit"
          label="Unit"
          onChange={(event) => onFilterChange("unitId", event.target.value)}
          value={unitId}
        >
          <PropertyUnitSelectOptions units={units.filter((unit) => !unit.isDeleted)} />
        </FilterSelectField>
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
LeaseFilterPanel.displayName = "LeaseFilterPanel";
