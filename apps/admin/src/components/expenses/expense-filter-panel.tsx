import { SlidersHorizontal } from "lucide-react";
import { memo } from "react";

import { FilterSelectField } from "@/components/filters/filter-select-field";
import { ResponsiveFilterPanel } from "@/components/filters/responsive-filter-panel";
import { Button } from "@/components/ui/button";
import { type TSelectOption } from "@/lib/select-option-types";

export type TExpenseFilterKey = "categoryId";

interface ExpenseFilterPanelProps {
  activeFilterCount: number;
  categoryFilterOptions: TSelectOption[];
  categoryId: string;
  onClear: () => void;
  onFilterChange: (key: TExpenseFilterKey, value: string) => void;
}

export const ExpenseFilterPanel = memo(
  ({
    activeFilterCount,
    categoryFilterOptions,
    categoryId,
    onClear,
    onFilterChange,
  }: ExpenseFilterPanelProps) => (
    <ResponsiveFilterPanel
      description="Narrow expenses without leaving the table."
      title="Expense filters"
      trigger={
        <Button type="button" variant="outline">
          <SlidersHorizontal />
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </Button>
      }
    >
      <div className="space-y-3">
        <FilterSelectField
          emptyOptionLabel="All categories"
          id="expense-filter-category"
          label="Category"
          onChange={(event) => onFilterChange("categoryId", event.target.value)}
          options={categoryFilterOptions}
          value={categoryId}
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
ExpenseFilterPanel.displayName = "ExpenseFilterPanel";
