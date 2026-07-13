import { memo } from "react";

import { DateFilterField } from "@/components/filters/date-filter-field";
import { DateRangePresetBar } from "@/components/filters/date-range-preset-bar";
import { type TDateRangePresetId } from "@/lib/date-range-presets";

interface LedgerDateRangeFilterProps {
  activePreset: TDateRangePresetId | null;
  from: string;
  idPrefix: string;
  onFromChange: (value: string) => void;
  onPresetChange: (presetId: TDateRangePresetId) => void;
  onToChange: (value: string) => void;
  to: string;
}

export const LedgerDateRangeFilter = memo(
  ({
    activePreset,
    from,
    idPrefix,
    onFromChange,
    onPresetChange,
    onToChange,
    to,
  }: LedgerDateRangeFilterProps) => (
    <div className="space-y-3">
      <DateRangePresetBar
        activePreset={activePreset}
        idPrefix={idPrefix}
        onPresetChange={onPresetChange}
      />
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <DateFilterField
          id={`${idPrefix}-from`}
          label="From"
          onChange={(event) => onFromChange(event.target.value)}
          value={from}
        />
        <DateFilterField
          id={`${idPrefix}-to`}
          label="To"
          onChange={(event) => onToChange(event.target.value)}
          value={to}
        />
      </div>
    </div>
  )
);
LedgerDateRangeFilter.displayName = "LedgerDateRangeFilter";
