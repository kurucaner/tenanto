import { memo } from "react";

import { FilterSelectField } from "@/components/filters/filter-select-field";
import { CATEGORY_OPTIONS, STATUS_OPTIONS } from "@/components/support/support-constants";
import { Button } from "@/components/ui/button";

export const SupportFiltersBar = memo(
  ({
    categoryInput,
    idPrefix,
    onApply,
    onCategoryChange,
    onStatusChange,
    statusInput,
  }: Readonly<{
    categoryInput: string;
    idPrefix: string;
    onApply: () => void;
    onCategoryChange: (value: string) => void;
    onStatusChange: (value: string) => void;
    statusInput: string;
  }>) => (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
      <FilterSelectField
        fieldClassName="min-w-[160px] flex-1"
        id={`${idPrefix}-status`}
        label="Status"
        onChange={(e) => onStatusChange(e.target.value)}
        options={STATUS_OPTIONS}
        value={statusInput}
      />
      <FilterSelectField
        fieldClassName="min-w-[160px] flex-1"
        id={`${idPrefix}-category`}
        label="Category"
        onChange={(e) => onCategoryChange(e.target.value)}
        options={CATEGORY_OPTIONS}
        value={categoryInput}
      />
      <Button onClick={onApply} type="button" variant="secondary">
        Apply filters
      </Button>
    </div>
  )
);
SupportFiltersBar.displayName = "SupportFiltersBar";
