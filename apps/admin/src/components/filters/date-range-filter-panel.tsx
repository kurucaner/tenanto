import { CalendarDays, ChevronDown } from "lucide-react";
import { memo } from "react";

import { LedgerDateRangeFilter } from "@/components/filters/ledger-date-range-filter";
import { ResponsiveFilterPanel } from "@/components/filters/responsive-filter-panel";
import { Button } from "@/components/ui/button";
import { getDateRangeSummary, type TDateRangePresetId } from "@/lib/date-range-presets";

interface DateRangeFilterPanelProps {
  activePreset: TDateRangePresetId | null;
  from: string;
  idPrefix: string;
  onFromChange: (value: string) => void;
  onPresetChange: (presetId: TDateRangePresetId) => void;
  onToChange: (value: string) => void;
  presets?: readonly { id: TDateRangePresetId; label: string }[];
  to: string;
}

export const DateRangeFilterPanel = memo(
  ({
    activePreset,
    from,
    idPrefix,
    onFromChange,
    onPresetChange,
    onToChange,
    presets,
    to,
  }: DateRangeFilterPanelProps) => {
    const summary = getDateRangeSummary(activePreset, from, to);

    return (
      <ResponsiveFilterPanel
        description="Choose a preset or enter a custom range."
        title="Date range"
        trigger={
          <Button type="button" variant="outline">
            <CalendarDays />
            <span className="hidden sm:inline">Date:</span> {summary}
            <ChevronDown />
          </Button>
        }
      >
        <LedgerDateRangeFilter
          activePreset={activePreset}
          from={from}
          idPrefix={idPrefix}
          onFromChange={onFromChange}
          onPresetChange={onPresetChange}
          onToChange={onToChange}
          presets={presets}
          to={to}
        />
      </ResponsiveFilterPanel>
    );
  }
);
DateRangeFilterPanel.displayName = "DateRangeFilterPanel";
