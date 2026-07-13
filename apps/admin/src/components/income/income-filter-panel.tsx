import { SlidersHorizontal } from "lucide-react";
import { memo } from "react";

import { FilterSelectField } from "@/components/filters/filter-select-field";
import { ResponsiveFilterPanel } from "@/components/filters/responsive-filter-panel";
import { Button } from "@/components/ui/button";
import { PropertyUnitSelectOptions } from "@/components/units/property-unit-select-options";
import { type TSelectOption } from "@/lib/select-option-types";
import { type IPropertyUnit } from "@/packages/shared";

export type TIncomeFilterKey =
  | "channelCommissionId"
  | "incomeType"
  | "refundStatus"
  | "status"
  | "unitId";

interface IncomeFilterPanelProps {
  activeFilterCount: number;
  channelCommissionId: string;
  channelFilterOptions: TSelectOption[];
  incomeType: string;
  incomeTypeFilterOptions: TSelectOption[];
  onClear: () => void;
  onFilterChange: (key: TIncomeFilterKey, value: string) => void;
  refundStatus: string;
  refundStatusFilterOptions: TSelectOption[];
  showStays: boolean;
  status: string;
  statusOptions: TSelectOption[];
  unitId: string;
  units: IPropertyUnit[];
}

export const IncomeFilterPanel = memo(
  ({
    activeFilterCount,
    channelCommissionId,
    channelFilterOptions,
    incomeType,
    incomeTypeFilterOptions,
    onClear,
    onFilterChange,
    refundStatus,
    refundStatusFilterOptions,
    showStays,
    status,
    statusOptions,
    unitId,
    units,
  }: IncomeFilterPanelProps) => (
    <ResponsiveFilterPanel
      description="Narrow income entries without leaving the table."
      title="Income filters"
      trigger={
        <Button type="button" variant="outline">
          <SlidersHorizontal />
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </Button>
      }
    >
      <div className="space-y-3">
        <FilterSelectField
          id="income-filter-unit"
          label="Unit"
          onChange={(event) => onFilterChange("unitId", event.target.value)}
          value={unitId}
        >
          <PropertyUnitSelectOptions emptyOptionLabel="All units" units={units} />
        </FilterSelectField>
        <FilterSelectField
          id="income-filter-type"
          label="Income type"
          onChange={(event) => onFilterChange("incomeType", event.target.value)}
          options={incomeTypeFilterOptions}
          value={incomeType}
        />
        <FilterSelectField
          disabled={!showStays}
          emptyOptionLabel="All channels"
          id="income-filter-channel"
          label="Channel"
          onChange={(event) => onFilterChange("channelCommissionId", event.target.value)}
          options={channelFilterOptions}
          value={channelCommissionId}
        />
        <FilterSelectField
          disabled={!showStays}
          emptyOptionLabel="All statuses"
          id="income-filter-status"
          label="Status"
          onChange={(event) => onFilterChange("status", event.target.value)}
          options={statusOptions}
          value={status}
        />
        <FilterSelectField
          id="income-filter-refund"
          label="Refund"
          onChange={(event) => onFilterChange("refundStatus", event.target.value)}
          options={refundStatusFilterOptions}
          value={refundStatus}
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
IncomeFilterPanel.displayName = "IncomeFilterPanel";
