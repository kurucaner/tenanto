import { memo } from "react";

import { DateFilterField } from "@/components/filters/date-filter-field";
import { FilterSelectField } from "@/components/filters/filter-select-field";
import { RENTAL_TYPE_FILTER_OPTIONS } from "@/components/reports/report-form-options";
import { PropertyUnitSelectOptions } from "@/components/units/property-unit-select-options";
import { getLedgerFiltersGridClass } from "@/lib/ledger-filter-grid";
import type { IPropertyUnit } from "@/packages/shared";

export interface ReportFiltersBarProps {
  channelCommissionId?: string;
  channelOptions?: { label: string; value: string }[];
  from: string;
  onChannelChange?: (value: string) => void;
  onFromChange: (value: string) => void;
  onRentalTypeChange: (value: string) => void;
  onToChange: (value: string) => void;
  onUnitChange?: (value: string) => void;
  rentalType: string;
  showChannelFilter?: boolean;
  showUnitFilter?: boolean;
  to: string;
  unitId?: string;
  units?: IPropertyUnit[];
}

export const ReportFiltersBar = memo(
  ({
    channelCommissionId = "",
    channelOptions = [],
    from,
    onChannelChange,
    onFromChange,
    onRentalTypeChange,
    onToChange,
    onUnitChange,
    rentalType,
    showChannelFilter = false,
    showUnitFilter = false,
    to,
    unitId = "",
    units = [],
  }: ReportFiltersBarProps) => {
    const filterCount = 2 + (showUnitFilter ? 1 : 0) + (showChannelFilter ? 1 : 0) + 1;

    return (
      <div className="space-y-4">
        <div className={getLedgerFiltersGridClass(filterCount)}>
          <DateFilterField
            id="report-from"
            label="From"
            onChange={(e) => onFromChange(e.target.value)}
            value={from}
          />
          <DateFilterField
            id="report-to"
            label="To"
            onChange={(e) => onToChange(e.target.value)}
            value={to}
          />
          {showUnitFilter ? (
            <FilterSelectField
              id="report-unit"
              label="Unit"
              onChange={(e) => onUnitChange?.(e.target.value)}
              value={unitId}
            >
              <PropertyUnitSelectOptions emptyOptionLabel="All units" units={units} />
            </FilterSelectField>
          ) : null}
          {showChannelFilter ? (
            <FilterSelectField
              emptyOptionLabel="All channels"
              id="report-channel"
              label="Channel"
              onChange={(e) => onChannelChange?.(e.target.value)}
              options={channelOptions}
              value={channelCommissionId}
            />
          ) : null}
          <FilterSelectField
            id="report-rental-type"
            label="Rental type"
            onChange={(e) => onRentalTypeChange(e.target.value)}
            options={RENTAL_TYPE_FILTER_OPTIONS}
            value={rentalType}
          />
        </div>

        {rentalType ? (
          <p className="text-muted-foreground text-xs">
            Expenses are property-wide and included when the property has units of the selected
            rental type.
          </p>
        ) : null}
      </div>
    );
  }
);
ReportFiltersBar.displayName = "ReportFiltersBar";
