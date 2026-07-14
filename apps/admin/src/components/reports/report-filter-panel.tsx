import { SlidersHorizontal } from "lucide-react";
import { memo } from "react";

import { FilterSelectField } from "@/components/filters/filter-select-field";
import { ResponsiveFilterPanel } from "@/components/filters/responsive-filter-panel";
import { RENTAL_TYPE_FILTER_OPTIONS } from "@/components/reports/report-form-options";
import { Button } from "@/components/ui/button";
import { PropertyUnitSelectOptions } from "@/components/units/property-unit-select-options";
import { type TSelectOption } from "@/lib/select-option-types";
import { type IPropertyUnit } from "@/packages/shared";

export type TReportFilterKey = "channelCommissionId" | "rentalType" | "unitId";

interface ReportFilterPanelProps {
  activeFilterCount: number;
  channelCommissionId: string;
  channelOptions: TSelectOption[];
  onClear: () => void;
  onFilterChange: (key: TReportFilterKey, value: string) => void;
  rentalType: string;
  unitId: string;
  units: IPropertyUnit[];
}

export const ReportFilterPanel = memo(
  ({
    activeFilterCount,
    channelCommissionId,
    channelOptions,
    onClear,
    onFilterChange,
    rentalType,
    unitId,
    units,
  }: ReportFilterPanelProps) => (
    <ResponsiveFilterPanel
      description="Narrow reports without leaving the page."
      title="Report filters"
      trigger={
        <Button type="button" variant="outline">
          <SlidersHorizontal />
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </Button>
      }
    >
      <div className="space-y-3">
        <FilterSelectField
          emptyOptionLabel="All units"
          id="report-filter-unit"
          label="Unit"
          onChange={(event) => onFilterChange("unitId", event.target.value)}
          value={unitId}
        >
          <PropertyUnitSelectOptions units={units.filter((unit) => !unit.isDeleted)} />
        </FilterSelectField>
        <FilterSelectField
          emptyOptionLabel="All channels"
          id="report-filter-channel"
          label="Channel"
          onChange={(event) => onFilterChange("channelCommissionId", event.target.value)}
          options={channelOptions}
          value={channelCommissionId}
        />
        <FilterSelectField
          id="report-filter-rental-type"
          label="Rental type"
          onChange={(event) => onFilterChange("rentalType", event.target.value)}
          options={RENTAL_TYPE_FILTER_OPTIONS}
          value={rentalType}
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
ReportFilterPanel.displayName = "ReportFilterPanel";
