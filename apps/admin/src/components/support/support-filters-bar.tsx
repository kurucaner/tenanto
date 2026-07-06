import { memo } from "react";

import {
  CATEGORY_OPTIONS,
  STATUS_OPTIONS,
  supportSelectClass,
} from "@/components/support/support-constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

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
      <div className="flex min-w-[160px] flex-1 flex-col gap-2">
        <Label htmlFor={`${idPrefix}-status`}>Status</Label>
        <select
          className={supportSelectClass}
          id={`${idPrefix}-status`}
          onChange={(e) => onStatusChange(e.target.value)}
          value={statusInput}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-[160px] flex-1 flex-col gap-2">
        <Label htmlFor={`${idPrefix}-category`}>Category</Label>
        <select
          className={supportSelectClass}
          id={`${idPrefix}-category`}
          onChange={(e) => onCategoryChange(e.target.value)}
          value={categoryInput}
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <Button onClick={onApply} type="button" variant="secondary">
        Apply filters
      </Button>
    </div>
  )
);
SupportFiltersBar.displayName = "SupportFiltersBar";
