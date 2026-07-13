import { memo } from "react";

import { FilterPill } from "@/components/filters/filter-pill";
import { DATE_RANGE_PRESET_OPTIONS, type TDateRangePresetId } from "@/lib/date-range-presets";

interface DateRangePresetBarProps {
  activePreset: TDateRangePresetId | null;
  idPrefix: string;
  onPresetChange: (presetId: TDateRangePresetId) => void;
  presets?: readonly { id: TDateRangePresetId; label: string }[];
}

export const DateRangePresetBar = memo(
  ({
    activePreset,
    idPrefix,
    onPresetChange,
    presets = DATE_RANGE_PRESET_OPTIONS,
  }: DateRangePresetBarProps) => (
    <div className="flex flex-wrap gap-2">
      {presets.map(({ id, label }) => (
        <FilterPill
          id={`${idPrefix}-preset-${id}`}
          key={id}
          onClick={() => onPresetChange(id)}
          selected={activePreset === id}
        >
          {label}
        </FilterPill>
      ))}
    </div>
  )
);
DateRangePresetBar.displayName = "DateRangePresetBar";
