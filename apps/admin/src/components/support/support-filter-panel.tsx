import { SlidersHorizontal } from "lucide-react";
import { memo } from "react";

import { FilterSelectField } from "@/components/filters/filter-select-field";
import { ResponsiveFilterPanel } from "@/components/filters/responsive-filter-panel";
import { CATEGORY_OPTIONS, STATUS_OPTIONS } from "@/components/support/support-constants";
import { Button } from "@/components/ui/button";

export type TSupportFilterKey = "category" | "status";

interface ISupportFilterPanelProps {
  activeFilterCount: number;
  category: string;
  onClear: () => void;
  onFilterChange: (key: TSupportFilterKey, value: string) => void;
  status: string;
}

export const SupportFilterPanel = memo(
  ({
    activeFilterCount,
    category,
    onClear,
    onFilterChange,
    status,
  }: ISupportFilterPanelProps) => (
    <ResponsiveFilterPanel
      description="Narrow requests without leaving the table."
      title="Support filters"
      trigger={
        <Button type="button" variant="outline">
          <SlidersHorizontal />
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </Button>
      }
    >
      <div className="space-y-3">
        <FilterSelectField
          id="support-filter-status"
          label="Status"
          onChange={(event) => onFilterChange("status", event.target.value)}
          options={STATUS_OPTIONS}
          value={status}
        />
        <FilterSelectField
          id="support-filter-category"
          label="Category"
          onChange={(event) => onFilterChange("category", event.target.value)}
          options={CATEGORY_OPTIONS}
          value={category}
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
SupportFilterPanel.displayName = "SupportFilterPanel";
